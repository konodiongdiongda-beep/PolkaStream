# PolkaStream Frontend (Vite)

PolkaStream 前端控制台，连接 Polkadot Hub TestNet 上已部署合约，支持：

- 钱包连接（MetaMask / SubWallet）
- 创建流支付（createStream）
- 提款、暂停、恢复、取消（withdraw/pause/resume/cancel）
- 失败通知重试（retryNotify）
- Dashboard / Streams / Settlements / Ops / Settings

## Local Run

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

默认地址：`http://localhost:3000`

## Build Check

```bash
pnpm ci-check
```

## Vercel Deploy

### Required Environment Variables

在 Vercel Project Settings -> Environment Variables 配置：

- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_POLKASTREAM_ADDRESS`
- `NEXT_PUBLIC_TOKEN_PRESETS`（可选）
- `NEXT_PUBLIC_ADMIN_ALLOWLIST`（可选，逗号分隔，决定是否显示 Ops 页签）

### Deploy Commands

```bash
# Preview
vercel --yes

# Production
vercel --prod --yes
```

若使用 Token：

```bash
VERCEL_TOKEN=xxxx vercel --prod --yes --token "$VERCEL_TOKEN"
```
