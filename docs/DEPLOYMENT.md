# DEPLOYMENT EVIDENCE (2026-03-09)

## 1. Scope

- Network: `polkadot-hub-testnet`
- Chain ID: `420420417`
- Deployer: `0x064acEdF8b6c59D2E53230d3ebf72Ff19d8Ffa3e`
- Release Tag: `release-gate-v2-20260309`

## 2. Archived Artifacts

- Release gate summary: `docs/deployment-artifacts/release-gate-20260309.json`
- Manual run-latest (authoritative on-chain tx archive): `docs/deployment-artifacts/manual-run-latest-420420417.json`
- Cache mirror for reproducibility: `docs/deployment-artifacts/cache-run-latest-420420417.json`
- Forge script run artifact (historical): `docs/deployment-artifacts/deploy-script-run-latest-420420417.json`

Note: the final production deployment was broadcast via `cast send --create`, and is fully anchored by on-chain tx receipts below.

## 3. On-Chain Transactions

1. Deploy `XcmPrecompileNotifier`
- Tx: `0x10c20cfb373b2d1aa13878473d493fa0bb538282bcdbb25c5ea9e20f8216adf7`
- Contract: `0xb74411FcD5DB3B3e40f4a3FeE2144eA01E4Dd00e`
- Block: `6181838`
- Timestamp (UTC): `2026-03-09T08:21:24Z`

2. Deploy `PolkaStream`
- Tx: `0xb53e52661426cc049ce10d4bef57ad229bfc3c7d8f7984082bd3ad561e02c6c8`
- Contract: `0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D`
- Block: `6181868`
- Timestamp (UTC): `2026-03-09T08:23:24Z`

3. Post-deploy allowlist init
- Tx: `0x902ffe010460b6d56e6b79036f36e5032cb4652cb8b9ff19974c195076c29bf5`
- Call: `setTokenAllowlist(0xEe470D349633715a77A93B61E43eF0c881E8410B, true)`
- Block: `6182312`
- Timestamp (UTC): `2026-03-09T08:39:24Z`

## 4. Deployment Parameters (Decoded)

- `XcmPrecompileNotifier.constructor(address precompile)`
  - `precompile = 0x00000000000000000000000000000000000A0000`

- `PolkaStream.constructor(address notifier, uint256 maxDuration, uint256 maxDepositPerStream)`
  - `notifier = 0xb74411FcD5DB3B3e40f4a3FeE2144eA01E4Dd00e`
  - `maxDuration = 31536000`
  - `maxDepositPerStream = 1000000000000000000000000000`

## 5. Independent Verification Commands

```bash
RPC_URL="https://services.polkadothub-rpc.com/testnet"

# Receipts
cast rpc --rpc-url "$RPC_URL" eth_getTransactionReceipt 0x10c20cfb373b2d1aa13878473d493fa0bb538282bcdbb25c5ea9e20f8216adf7
cast rpc --rpc-url "$RPC_URL" eth_getTransactionReceipt 0xb53e52661426cc049ce10d4bef57ad229bfc3c7d8f7984082bd3ad561e02c6c8
cast rpc --rpc-url "$RPC_URL" eth_getTransactionReceipt 0x902ffe010460b6d56e6b79036f36e5032cb4652cb8b9ff19974c195076c29bf5

# Decode PolkaStream constructor args from tx input
POLKA_TX_INPUT=$(cast rpc --rpc-url "$RPC_URL" eth_getTransactionByHash 0xb53e52661426cc049ce10d4bef57ad229bfc3c7d8f7984082bd3ad561e02c6c8 | jq -r '.input')
POLKA_ARGS=0x${POLKA_TX_INPUT: -192}
cast decode-abi --input "constructor(address,uint256,uint256)" "$POLKA_ARGS"

# Decode notifier constructor arg from tx input
NOTIFIER_TX_INPUT=$(cast rpc --rpc-url "$RPC_URL" eth_getTransactionByHash 0x10c20cfb373b2d1aa13878473d493fa0bb538282bcdbb25c5ea9e20f8216adf7 | jq -r '.input')
NOTIFIER_ARG=0x${NOTIFIER_TX_INPUT: -64}
cast decode-abi --input "constructor(address)" "$NOTIFIER_ARG"

# Live chain state checks
cast call 0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D "notifier()(address)" --rpc-url "$RPC_URL"
cast call 0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D "strictXcm()(bool)" --rpc-url "$RPC_URL"
cast call 0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D "isNotifierHealthy()(bool)" --rpc-url "$RPC_URL"
cast call 0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D "maxDuration()(uint256)" --rpc-url "$RPC_URL"
cast call 0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D "maxDepositPerStream()(uint256)" --rpc-url "$RPC_URL"
cast call 0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D "tokenAllowlist(address)(bool)" 0xEe470D349633715a77A93B61E43eF0c881E8410B --rpc-url "$RPC_URL"
```

## 6. One-Command Sanity Check

```bash
source .env
script/post_deploy_check.sh
```

## 7. Frontend (Vercel) Release Status

- Frontend runtime: Vite (`frontend/`)
- Build gate: `pnpm -C frontend ci-check` (pass on 2026-03-10)
- Deploy command:

```bash
./script/deploy_frontend_vercel.sh
```

- Release completed on 2026-03-10 09:43:05 (Asia/Shanghai), status `Ready`.
- Deployment ID: `dpl_FsvtVYHxjhFZh2FzrfJ2GNWH5Jf8`
- Production URL: `https://frontend-dxgqfor1f-ddbbs-projects-9779c35f.vercel.app`
- Preferred public alias: `https://polkastream-console.vercel.app`
- Active alias:
  - `https://polkastream-console.vercel.app`
  - `https://frontend-mauve-beta-68.vercel.app`
  - `https://frontend-ddbbs-projects-9779c35f.vercel.app`
  - `https://frontend-konodiongdiongda-3353-ddbbs-projects-9779c35f.vercel.app`

### Vercel Runtime Env (configured)

- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_POLKASTREAM_ADDRESS`
- `NEXT_PUBLIC_TOKEN_PRESETS`

These variables are set for `production`, `preview`, and `development`.
