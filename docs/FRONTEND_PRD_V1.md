# PolkaStream Frontend PRD v1

- Version: `v1.0.0`
- Date: `2026-03-09`
- Scope: `PolkaStream + AI Request-Level Settlement`
- Target Network: `Polkadot Hub TestNet (Chain ID 420420417)`

## 1. Product Definition

### 1.1 One-line definition

PolkaStream is an on-chain streaming payment product with AI request-level batched settlement:

- users stream funds by second on-chain,
- high-frequency AI usage is metered off-chain and settled on-chain in 30s windows.

### 1.2 Target users

1. Sender (payer): creates and manages streams.
2. Receiver (payee): withdraws accrued funds.
3. AI Provider: claims batched settlement payouts.
4. Ops/Governance: monitors notifier health, retries failed notifications, executes settlement windows.

### 1.3 Core value proposition

1. Real-time money release with transparent accounting.
2. Retryable notification path for reliability.
3. No per-request on-chain writes for AI traffic, reducing gas and tx amplification.

### 1.4 Out of scope in v1

1. Fiat payment and KYC flow.
2. Cross-chain bridge UI.
3. Monthly invoicing and enterprise ERP integration.

## 2. Service Boundary and Public Ports

### 2.1 Current implemented runtime

1. Frontend dApp: Next.js app.
2. Smart contracts:
   - `PolkaStream.sol`
   - `UsageSettlementHub.sol`
3. AI settlement sidecar: CLI scripts (`adapter` + `settlement-daemon`), not HTTP service yet.

### 2.2 Public port plan (for production)

1. `443` -> `app.<domain>` (frontend web).
2. `443` -> `api.<domain>` (BFF/API for AI settlement dashboard and ops views).
3. `80` -> redirect to `443` only.

### 2.3 Non-public/internal only

1. DB, cache, worker ports.
2. Internal observability stack.
3. Private key signing workers.

## 3. Frontend Information Architecture

### 3.1 Route map

1. `/` Dashboard
2. `/streams/create` Create stream
3. `/streams` Stream list and lifecycle actions
4. `/ai-settlement` AI settlement dashboard and claim
5. `/ops` Ops status (preflight, notifier, retry queue summary)

### 3.2 Global layout blocks

1. Header: brand, network, wallet status, account switch.
2. Left navigation: dashboard, streams, ai settlement, ops.
3. Main content: page modules.
4. Global status bar: preflight result and latest chain sync time.

## 4. Page-Level Requirements

### 4.1 Dashboard (`/`)

#### Goal

Provide 5-second clarity:

1. what this product is,
2. current account status,
3. key balance and stream indicators.

#### Modules

1. Product hero
2. Wallet card
3. Preflight check card
4. KPIs:
   - active streams
   - paused streams
   - canceled streams
   - total owed (receiver view)
5. Latest stream activities (event timeline)

### 4.2 Create Stream (`/streams/create`)

#### Form fields

1. `receiver` (address, required)
2. `token` (address, required)
3. `deposit` (decimal string, required, > 0)
4. `durationInSeconds` (integer, required, > 0)
5. `cliffInSeconds` (integer, required, >= 0)

#### Pre-submit checks

1. wallet connected
2. chain id matches `420420417`
3. contract configured (`NEXT_PUBLIC_POLKASTREAM_ADDRESS`)
4. notifier healthy (`isNotifierHealthy`)
5. token allowlisted (`tokenAllowlist(token)`)
6. allowance sufficient (auto approve if needed)

#### Submit flow

1. optional `approve` tx
2. `createStream` tx
3. wait receipt
4. show explorer link and update list

### 4.3 Streams (`/streams`)

#### Data shown per stream

1. stream id
2. sender and receiver
3. token symbol and amount
4. deposit / withdrawn / owed
5. start time / cliff end
6. progress bar
7. status chip: `Active`, `Paused`, `Canceled`
8. failed notify list

#### Actions by role and state

1. Receiver:
   - `Withdraw` when `owed > 0` and not canceled
2. Sender:
   - `Pause` when active and not completed
   - `Resume` when paused
   - `Cancel` when not canceled
3. Both actions disabled when global preflight fails.

### 4.4 AI Settlement (`/ai-settlement`)

#### Goal

Expose request-level settlement economics and payout operations.

#### Modules

1. Metrics cards:
   - request events
   - batched windows
   - tx reduction %
   - avg aggregation latency
   - estimated gas saving %
2. Window table:
   - window id
   - item count
   - total amount
   - total requests
   - settlement status
3. Escrow panel:
   - payer escrow by token
4. Provider claim panel:
   - claimable by token
   - claim action

### 4.5 Ops (`/ops`)

#### Modules

1. Notifier health status
2. Last preflight time
3. Failed notify queue summary
4. Settlement retry queue summary
5. External command references for operators

## 5. Contract Interface Requirements

### 5.1 PolkaStream (user-facing)

### Write methods

1. `createStream(address receiver,uint256 deposit,uint256 durationInSeconds,uint256 cliffInSeconds,address token)`
2. `withdraw(uint256 streamId)`
3. `pauseStream(uint256 streamId)`
4. `resumeStream(uint256 streamId)`
5. `cancelStream(uint256 streamId)`
6. `retryNotify(uint256 streamId,uint256 withdrawId)`

### Read methods

1. `getOwed(uint256 streamId)`
2. `getStream(uint256 streamId)`
3. `getSenderStreams(address sender)`
4. `getReceiverStreams(address receiver)`
5. `getStreamWithdrawIds(uint256 streamId)`
6. `getNotifyStatus(uint256 withdrawId)`
7. `tokenAllowlist(address token)`
8. `isNotifierHealthy()`
9. `notifier()`

### Events for incremental sync

1. `StreamCreated`
2. `Withdrawn`
3. `StreamPaused`
4. `StreamResumed`
5. `StreamCanceled`
6. `NotifyStatusUpdated`

### 5.2 UsageSettlementHub (AI settlement-facing)

### Write methods

1. `depositEscrow(address token,uint256 amount)`
2. `withdrawEscrow(address token,uint256 amount)`
3. `claim(address token,uint256 amount,address receiver)`
4. `settleWindow(bytes32 windowId,SettlementItem[] items)` (owner/operator)

### Read methods

1. `tokenAllowlist(address token)`
2. `payerEscrow(address payer,address token)`
3. `providerClaimable(address provider,address token)`
4. `settledWindows(bytes32 windowId)`

## 6. API Requirements (for BFF layer)

Note: BFF API is now implemented at `services/api/server.mjs`. The following APIs are required for frontend integration and are exposed by that server.

### 6.1 Health and config

1. `GET /v1/health`
2. `GET /v1/config`

#### `GET /v1/config` response example

```json
{
  "chainId": 420420417,
  "rpcUrl": "https://services.polkadothub-rpc.com/testnet",
  "contracts": {
    "polkaStream": "0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D",
    "usageSettlementHub": "0x..."
  },
  "settlementWindowSeconds": 30
}
```

### 6.2 Usage ingestion and settlement

1. `POST /v1/usage-events`
2. `POST /v1/settlement/preview`
3. `POST /v1/settlement/submit`
4. `POST /v1/settlement/retry`
5. `GET /v1/settlement/metrics?from=<ts>&to=<ts>`

### 6.3 Payout and escrow view

1. `GET /v1/payers/{address}/escrow?token=<address>`
2. `GET /v1/providers/{address}/claimable?token=<address>`

### 6.4 Error response format

```json
{
  "code": "TOKEN_NOT_ALLOWED",
  "message": "Token is not in allowlist",
  "requestId": "req_123"
}
```

## 7. UI State and Status Mapping

### 7.1 Stream state

1. `Active`: `!isPaused && !isCanceled`
2. `Paused`: `isPaused && !isCanceled`
3. `Canceled`: `isCanceled`

### 7.2 Notify state

1. `0 NONE`
2. `1 PENDING`
3. `2 SUCCESS`
4. `3 FAILED`

### 7.3 Transaction state

1. `IDLE`
2. `SIGNING`
3. `PENDING`
4. `CONFIRMED`
5. `FAILED`

## 8. Error Copy Requirements

Use user-facing messages (Chinese) while keeping raw errors in console only.

### 8.1 Contract/revert mapping

1. `TOKEN_NOT_ALLOWED` -> `该 Token 未加入白名单，请更换 Token 或联系治理方。`
2. `DURATION_TOO_LONG` -> `流支付时长超过合约上限，请缩短 duration。`
3. `DEPOSIT_TOO_LARGE` -> `存入金额超过合约上限，请降低 deposit。`
4. `XCM_NOTIFY_FAILED` -> `跨链通知失败，当前为严格模式，提款已回滚。`
5. `NOTHING_TO_WITHDRAW` -> `当前没有可提金额。`
6. `ONLY_RECEIVER` -> `仅接收方可执行该提款操作。`
7. `ONLY_SENDER` -> `仅发送方可执行该操作。`
8. `STREAM_CANCELED` -> `该流已取消，无法继续操作。`
9. `STREAM_NOT_FOUND` -> `未找到对应 Stream，请先刷新。`
10. user rejected -> `你已在钱包中取消交易签名。`

### 8.2 Generic fallback

1. Preflight fail -> `环境检查失败，请检查网络连接与合约配置。`
2. Read fail -> `读取链上数据失败，请稍后重试。`
3. Create fail -> `创建 Stream 失败，请检查参数、余额与授权。`
4. Retry fail -> `通知重试失败，请稍后重试。`

## 9. Performance and UX Requirements

### 9.1 Data refresh

1. Event incremental sync every `8s`.
2. Preflight refresh every `20s`.
3. Pagination page size `8`.

### 9.2 UX constraints

1. Action buttons must show pending state.
2. All confirmed tx must display explorer link.
3. Prevent destructive action spam by button lock.
4. Mobile and desktop both fully usable.

### 9.3 Accessibility baseline

1. Keyboard focus visible on all controls.
2. Color contrast for text >= WCAG AA.
3. Error/success feedback in text, not color-only.

## 10. Analytics and Event Tracking

### 10.1 Product events

1. `wallet_connect_clicked`
2. `wallet_connected`
3. `preflight_passed`
4. `preflight_failed`
5. `create_stream_submitted`
6. `create_stream_confirmed`
7. `stream_action_submitted` (withdraw/pause/resume/cancel)
8. `retry_notify_submitted`
9. `retry_notify_confirmed`
10. `ai_settlement_view_opened`
11. `provider_claim_submitted`
12. `provider_claim_confirmed`

### 10.2 Key dashboard metrics

1. Stream creation success rate
2. Withdraw success rate
3. Notify failure rate
4. Notify retry success rate
5. Settlement tx reduction %
6. Estimated gas saving %

## 11. Acceptance Criteria (Frontend DoD)

### 11.1 Functional

1. All page modules in Section 4 implemented.
2. All contract methods in Section 5 wired and tested.
3. Preflight check blocks transaction when failed.
4. Failed notify list and retry action available.
5. AI settlement page displays metrics and window list.

### 11.2 Quality

1. `pnpm lint` pass.
2. `pnpm typecheck` pass.
3. `pnpm build` pass.
4. No raw stack trace shown in UI.

### 11.3 Demo scenario

1. Create one stream successfully.
2. Receiver withdraws and tx confirmed.
3. Simulate notify failure and retry.
4. View AI settlement metrics from sample/bff data.
5. Provider completes one claim flow.

## 12. Delivery Notes for Design Team

### 12.1 Mandatory visual hierarchy

1. Hero must clearly say:
   - streaming payment,
   - AI request-level batched settlement,
   - why this is cheaper than per-request on-chain tx.
2. Preflight status must stay visible near action areas.
3. Stream state and amounts must be readable at glance.

### 12.2 Suggested copy

1. Headline: `Stablecoin Streaming + AI Usage Settlement`
2. Subheadline: `秒级消费体验，窗口化批结算成本`
3. Key bullets:
   - `按秒释放资金，状态透明可追踪`
   - `通知失败可链上补偿重试`
   - `请求级不上链逐笔写入，显著降低手续费`
