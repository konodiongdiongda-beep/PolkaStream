# AI Request-Level Settlement (T28)

## 1. Goal

在不把每个 AI 请求都上链的前提下，实现最小可用结算闭环：

`request -> usage_event (adapter) -> 30s aggregation (daemon) -> single settleWindow tx -> provider claim`

## 2. Components

### 2.1 OpenClaw Adapter

- File: `services/adapter/openclaw_adapter.mjs`
- Input: OpenClaw request JSONL（每行一个请求）
- Output: normalized `usage_event` JSONL
- Responsibility:
  - 计算 `amountWei = usageUnits * unitPriceWei`
  - 标准化事件字段（payer/provider/token/requestTs）
  - 计算窗口边界（默认 30s）

### 2.2 Settlement Daemon

- File: `services/settlement-daemon/settlement_daemon.mjs`
- Input: usage events JSONL
- Output: batched settlement JSON
- Responsibility:
  - 按 30s 窗口聚合
  - 同窗口按 `(payer, provider, token)` 聚合金额和请求数
  - 生成 `windowId`
  - 可选调用链上 `settleWindow`（`--submit`）
  - 失败窗口写入 retry queue，可 `--retry-only` 重放

### 2.3 Usage Settlement Sidecar (On-Chain)

- File: `contracts/UsageSettlementHub.sol`
- Responsibility:
  - payer 充值 escrow（`depositEscrow`）
  - daemon 批量结算（`settleWindow`）
  - provider 领取（`claim`）
  - `windowId` 防重放（`settledWindows`）
  - 失败回滚后可重试（窗口未标记 settled）

## 3. End-to-End Test Closure

### 3.1 Contract tests (on-chain flow)

Test file: `test/UsageSettlementHub.t.sol`

Covered cases:
1. `testE2E_BatchSettleThenProviderClaim`
- payer deposit -> owner settleWindow -> provider claim
2. `testSingleRequestNotOnchainUntilBatch`
- 单请求仅在链下存在 usage_event，不触发链上写入
3. `testSettleFailureCanRetryAfterTopUp`
- 第一次因 escrow 不足失败，补充后同 `windowId` 重试成功
4. `testSettleWindowCannotReplay`
- 已结算窗口不可重放
5. `testOnlyOwnerCanSettleWindow`
- 限制结算入口权限

Run:

```bash
forge test --match-contract UsageSettlementHubTest
```

### 3.2 Adapter + Daemon sample run (off-chain flow)

Sample request source:
- `services/adapter/samples/openclaw_requests.jsonl`

Run:

```bash
node services/adapter/openclaw_adapter.mjs \
  --in services/adapter/samples/openclaw_requests.jsonl \
  --out services/adapter/output/usage_events.jsonl

node services/settlement-daemon/settlement_daemon.mjs \
  --events services/adapter/output/usage_events.jsonl \
  --out services/settlement-daemon/output/batches.json
```

Generated:
- usage events: `services/adapter/output/usage_events.jsonl`
- aggregated windows + metrics: `services/settlement-daemon/output/batches.json`

## 4. Throughput / Latency / Fee Comparison

基于 sample run（5 requests, 30s window）:

| Metric | Request-level on-chain | 30s batched settlement |
| --- | ---: | ---: |
| On-chain tx count | 5 | 2 |
| Tx reduction | - | 60.00% |
| Throughput (req per settlement tx) | 1.00 | 2.50 |
| Avg aggregation latency | 0s | 21.8s |
| Estimated gas | 600,000 | 200,000 |
| Estimated gas saving | - | 66.67% |

Gas assumptions:
- per request tx: `120,000`
- per batch base: `70,000`
- per batch item: `30,000`

## 5. Submission / Retry Operations

Submit aggregated windows on-chain:

```bash
node services/settlement-daemon/settlement_daemon.mjs \
  --events services/adapter/output/usage_events.jsonl \
  --submit \
  --rpc-url "$RPC_URL" \
  --hub-address "$HUB_ADDRESS" \
  --private-key "$PRIVATE_KEY"
```

Retry failed windows:

```bash
node services/settlement-daemon/settlement_daemon.mjs \
  --retry-only \
  --retry-file services/settlement-daemon/output/retry_queue.json \
  --submit \
  --rpc-url "$RPC_URL" \
  --hub-address "$HUB_ADDRESS" \
  --private-key "$PRIVATE_KEY"
```

## 6. Minimal Integration Notes

- 该版本为 sidecar 结算最小闭环，不侵入现有 `PolkaStream` 主状态机。
- 结算失败默认不写入窗口完成标记，支持幂等重试。
- 单请求不上链，降低主链写放大与手续费。
