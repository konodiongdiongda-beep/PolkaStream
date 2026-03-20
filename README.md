# PolkaStream

PolkaStream 是面向 Polkadot Hub EVM 的稳定币流支付协议原型，支持：
- Cliff + 线性按秒释放
- `withdraw / pause / resume / cancel`
- 多 token（白名单）
- 可配置通知器（`IXcmNotifier`）
- 通知失败补偿重试（`retryNotify`）
- 治理参数控制（`Ownable2Step`）

PolkaStream is a stablecoin streaming payments protocol prototype on Polkadot Hub EVM.

Current external framing:
1. Core: `streaming payments`
2. Flagship scenario: `AI Agent Settlement`
3. Optional extension: `request-level batched settlement sidecar`

## Hackathon Quick Links

- Live console: `https://polkastream-console.vercel.app`
- Submission package: [`docs/HACKATHON_SUBMISSION.md`](docs/HACKATHON_SUBMISSION.md)
- Submission copy: [`docs/SUBMISSION_COPY.md`](docs/SUBMISSION_COPY.md)
- Demo video script: [`docs/DEMO_VIDEO_SCRIPT.md`](docs/DEMO_VIDEO_SCRIPT.md)
- Full pitch deck copy: [`docs/PITCH_DECK_FULL.md`](docs/PITCH_DECK_FULL.md)
- Pitch deck outline: [`docs/PITCH_DECK_OUTLINE.md`](docs/PITCH_DECK_OUTLINE.md)
- Commercial upgrade architecture: [`docs/ARCH_COMMERCIAL_TRIGGERED_STREAMS.md`](docs/ARCH_COMMERCIAL_TRIGGERED_STREAMS.md)
- Agent integration spec: [`docs/AGENT_INTEGRATION_SPEC.md`](docs/AGENT_INTEGRATION_SPEC.md)
- Agent MCP adapter: [`docs/AGENT_MCP_SKILL_ADAPTER.md`](docs/AGENT_MCP_SKILL_ADAPTER.md)
- ServicePlan spec: [`docs/SERVICE_PLAN_SPEC.md`](docs/SERVICE_PLAN_SPEC.md)
- Deployment evidence: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- Internal security review: [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md)

## Release Gate v2

- 版本：`v2.0.0-rc.2`（2026-03-09）
- 责任人：`Codex`
- 变更与回滚：[`docs/RELEASE_GATE_V2.md`](docs/RELEASE_GATE_V2.md)
- 部署证据链：[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## 当前关键语义
- 默认模式：`strictXcm = false`
  - 提款成功后尝试通知，通知失败不回滚提款，状态记为 `FAILED`，后续可重试。
- 严格模式：`strictXcm = true`
  - 提款后若通知失败，整笔交易回滚，保持强一致。

## 仓库结构
```text
contracts/
  PolkaStream.sol
  PolkaStreamServicePlanRegistry.sol
  XcmPrecompileNotifier.sol
  interfaces/IPolkaStreamServicePlanRegistry.sol
  interfaces/IXcmNotifier.sol
script/
  Deploy.s.sol
  HealthCheck.s.sol
  post_deploy_check.sh
  retry_failed_notify.sh
ops/
  metrics/export_weekly_metrics.sh
services/
  adapter/*
  agent-mcp/*
  settlement-daemon/*
  api/server.mjs
test/
  PolkaStream.t.sol
  PolkaStream.invariant.t.sol
frontend/
  src/App.tsx
  src/components/*
  src/hooks/usePolkaStream.ts
  src/lib/viem.ts
  vite.config.ts
docs/
  AGENT_INTEGRATION_SPEC.md
  AGENT_MCP_SKILL_ADAPTER.md
  SECURITY.md
  METRICS.md
  DEPLOYMENT.md
  SECURITY_REVIEW.md
  RELEASE_GATE_V2.md
  ARCH_AI_SETTLEMENT.md
  SERVICE_PLAN_SPEC.md
packages/
  polkastream-js/
```

## 环境变量
参考 [`.env.example`](.env.example)：
- `PRIVATE_KEY`
- `NOTIFIER_ADDRESS`
- `XCM_PRECOMPILE`
- `MAX_DURATION`
- `MAX_DEPOSIT_PER_STREAM`
- `NEXT_PUBLIC_POLKASTREAM_ADDRESS`
- `SERVICE_PLAN_REGISTRY_ADDRESS`
- `USAGE_SETTLEMENT_HUB_ADDRESS`（BFF/sidecar）
- `API_PORT`（BFF）
- `POLKASTREAM_MCP_RPC_URL`
- `POLKASTREAM_MCP_POLKASTREAM_ADDRESS`
- `POLKASTREAM_MCP_SERVICE_PLAN_REGISTRY_ADDRESS`
- `POLKASTREAM_MCP_PRIVATE_KEY`
- `POLKASTREAM_MCP_API_BASE_URL`
- `POLKASTREAM_MCP_API_TOKEN`

## 本地开发

### 1. 合约依赖
```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
```

### 2. 测试
```bash
forge test -vv
forge coverage --report summary
```

### 2.1 清理本地构建产物
```bash
script/clean_workspace.sh
```

### 3. 部署前健康检查
```bash
source .env
forge script script/HealthCheck.s.sol:HealthCheckScript \
  --rpc-url https://services.polkadothub-rpc.com/testnet
```

### 4. 部署
```bash
source .env
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://services.polkadothub-rpc.com/testnet \
  --broadcast
```

### 5. 前端
```bash
cd frontend
cp ../.env.example .env.local
pnpm install
pnpm dev
```

前端运行时使用 Vite（默认 `http://localhost:3000`），并通过 `envPrefix` 兼容 `NEXT_PUBLIC_*` 环境变量。

### 5.1 前端发布（Vercel）
```bash
./script/deploy_frontend_vercel.sh
```

若需显式 token：
```bash
VERCEL_TOKEN=<your_token> ./script/deploy_frontend_vercel.sh
```

### 5.2 BFF API
```bash
node services/api/server.mjs --host 0.0.0.0 --port 8787
```

默认读取：
- `RPC_URL` / `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_POLKASTREAM_ADDRESS`
- `USAGE_SETTLEMENT_HUB_ADDRESS`
- `PRIVATE_KEY`（仅在 `/v1/settlement/submit` 使用）
- `STREAM_TRIGGER_PRIVATE_KEY`（可选，默认回退到 `PRIVATE_KEY`，用于 `/v1/services/:serviceId/trigger`）
- `API_AUTH_TOKEN`（可选）

商业化触发式流支付最小闭环：
- `PUT /v1/services/:serviceId`：provider 注册服务与 `streamId`/期望 trigger policy 的绑定
- `GET /v1/streams/:streamId/commercial-state`：查询链上 `PENDING/ACTIVE` 与 deadline/trigger 状态
- `POST /v1/services/:serviceId/trigger`：在首个真实服务请求进入时触发 `activateStream`

### 5.3 SDK (NPM)
```bash
cd packages/polkastream-js
pnpm install
pnpm build
```

SDK usage见 `packages/polkastream-js/README.md`.

### 5.4 Agent MCP
```bash
cd services/agent-mcp
pnpm install
pnpm start
pnpm smoke
```

用于支持 MCP-capable agent 直接调用：
- `approve_token_spend`
- `create_pending_stream_from_plan`
- `create_service_plan`
- `activate_stream`
- `trigger_service`
- `preview_settlement / submit_settlement / retry_settlement`

配套文档：
- `services/agent-mcp/README.md`
- `docs/AGENT_MCP_SKILL_ADAPTER.md`

### 6. 部署后验收
```bash
source .env
script/post_deploy_check.sh
```

### 7. 失败通知批量补偿
```bash
source .env
script/retry_failed_notify.sh \
  --contract "$NEXT_PUBLIC_POLKASTREAM_ADDRESS" \
  --from-block 6181838 \
  --to-block latest \
  --dry-run
```

### 8. 周报导出
```bash
ops/metrics/export_weekly_metrics.sh \
  --contract 0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D \
  --from-block 6181838 \
  --to-block latest \
  --label weekly-2026w11
```

## 前端改造点
- 交易前置检查：
  - Chain ID
  - 合约地址配置
  - notifier 健康状态
  - token allowlist
- 错误分层：
  - UI 仅显示可执行提示
  - 详细异常仅输出控制台
- 数据读取优化：
  - 事件增量同步
  - 分页加载当前页 stream

## 协议治理与安全文档
- 安全与故障恢复：[`docs/SECURITY.md`](docs/SECURITY.md)
- 运行指标看板：[`docs/METRICS.md`](docs/METRICS.md)
- 部署证据链：[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- 安全复核清单：[`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md)
- 发布包（变更与回滚）：[`docs/RELEASE_GATE_V2.md`](docs/RELEASE_GATE_V2.md)
- AI 结算架构（T28）：[`docs/ARCH_AI_SETTLEMENT.md`](docs/ARCH_AI_SETTLEMENT.md)
- 商业化触发式流支付架构（T49）：[`docs/ARCH_COMMERCIAL_TRIGGERED_STREAMS.md`](docs/ARCH_COMMERCIAL_TRIGGERED_STREAMS.md)
- 前端产品需求（PRD v1）：[`docs/FRONTEND_PRD_V1.md`](docs/FRONTEND_PRD_V1.md)
- 2026-03-10 早报（执行状态）：[`docs/MORNING_REPORT_2026-03-10.md`](docs/MORNING_REPORT_2026-03-10.md)

## CI 质量门禁
见 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)：
- `forge test`
- `forge coverage`（`contracts/PolkaStream.sol` 分支覆盖率 >= 80%）
- `pnpm ci-check`（内部顺序：`lint -> typecheck -> build`）
- `script/ci_ai_settlement_check.sh`（校验 OpenClaw Adapter + Settlement Daemon 样例闭环）

## 许可
MIT
