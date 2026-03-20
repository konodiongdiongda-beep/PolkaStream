# SECURITY REVIEW (2026-03-09)

## 1. Scope

Review target:
- `contracts/PolkaStream.sol`
- `contracts/XcmPrecompileNotifier.sol`
- `script/HealthCheck.s.sol`
- new operational scripts (`post_deploy_check`, `retry_failed_notify`, `metrics export`)

Objective:
- close high-risk contract paths before release gate v2,
- produce auditable findings with severity and closure state.

## 2. Analysis Method

1. Automated checks
- `forge test -q` (all pass)
- `forge coverage --report summary` (`PolkaStream.sol` branches `92.77%`)
- static analyzers availability check:
  - `slither`: not installed in current environment
  - `mythril`: not installed in current environment

2. Manual high-risk path review
- withdrawal state transitions with external notifier call,
- strict mode rollback behavior,
- retry idempotency and replay handling,
- governance-only setters and parameter bounds,
- precompile health-check false-positive handling.

## 3. Findings

| ID | Area | Severity | Status | Detail |
| --- | --- | --- | --- | --- |
| SR-20260309-01 | Notifier health semantics | High | Closed | 已修复“EOA 空返回被误判健康”风险；`isHealthy` 与健康检查脚本均拒绝成功空返回。 |
| SR-20260309-02 | Withdraw + notify consistency | Medium | Closed | `strictXcm=false` 时提款与通知解耦并记录失败；`strictXcm=true` 时失败回滚。测试覆盖成功/失败路径。 |
| SR-20260309-03 | Retry replay safety | Medium | Closed | `retryNotify` 对已成功记录幂等返回，不会重复改变成功状态；失败重试可审计。 |
| SR-20260309-04 | Governance control | Medium | Closed | `setNotifier/setStrictXcm/setTokenAllowlist/setMax*` 均受 `onlyOwner` 限制，且对关键参数有非零/边界校验。 |
| SR-20260309-05 | Ops key handling | Low | Mitigated | 批量重试脚本仅在显式提供私钥时发送交易，支持 `--dry-run`；建议生产使用专用热钱包和最小权限 CI Secret。 |

## 4. Residual Risk

- 本轮环境未安装 Slither/Mythril，未执行这两类静态分析器。
- 已通过高覆盖率测试与手工路径复核补位，后续建议在安全流水线补充 Slither。

## 5. Release Decision

- Blocking issues: `0`
- High severity open: `0`
- Medium severity open: `0`
- Decision: `PASS for release-gate-v2`
