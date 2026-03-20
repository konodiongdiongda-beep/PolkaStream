# PolkaStream 早报（2026-03-10）

## 1) 总体结论

- 合约侧：已在 Polkadot Hub TestNet 上链并可读。
- 前端侧：已替换为 `polkastream-ops` 模板并完成链上交互集成，构建通过。
- 发布侧：已完成 Vercel 生产发布，线上可访问。

## 2) 已完成项

1. 前端模板替换并集成真实链上功能：
   - 钱包连接（MetaMask/SubWallet）
   - `createStream`
   - `withdraw / pause / resume / cancel`
   - `retryNotify`
   - 失败通知展示、预检查、结算页、运维页
2. 代码与构建优化：
   - Vite 构建分包（`index/charts/viem/icons`）
   - Ops 管理入口改为 `NEXT_PUBLIC_ADMIN_ALLOWLIST` 环境变量配置
3. 质量校验：
   - `forge test` 通过（43 passed, 0 failed）
   - `pnpm -C frontend ci-check` 通过
   - `./script/ci_ai_settlement_check.sh` 通过

## 3) 链上状态复核

- Contract: `0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D`
- `isNotifierHealthy = true`
- `notifier = 0xb74411FcD5DB3B3e40f4a3FeE2144eA01E4Dd00e`
- `strictXcm = false`
- `maxDuration = 31536000`
- `maxDepositPerStream = 1e27`
- `nextStreamId = 1`
- `nextWithdrawId = 1`

说明：合约代码和治理参数已上链；当前还没有真实业务流创建（计数仍为 1）。

## 4) 前端线上地址

```bash
Production: https://frontend-dxgqfor1f-ddbbs-projects-9779c35f.vercel.app
Alias:      https://frontend-mauve-beta-68.vercel.app
Preferred:  https://polkastream-console.vercel.app
```

## 5) 发布记录

1. Vercel Project: `ddbbs-projects-9779c35f/frontend`
2. Deployment ID: `dpl_FsvtVYHxjhFZh2FzrfJ2GNWH5Jf8`
3. Status: `Ready`
4. 环境变量：`NEXT_PUBLIC_RPC_URL / CHAIN_ID / POLKASTREAM_ADDRESS / TOKEN_PRESETS` 已配置到 production/preview/development。

## 6) 明早第一步建议

1. 用真实钱包在线上地址完成一笔 create+withdraw 冒烟。
2. 通过 `vercel inspect` 归档本次部署截图或日志到项目文档。
