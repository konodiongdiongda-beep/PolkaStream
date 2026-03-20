# SECURITY: Threat Model, Recovery, Governance

## 1. Threat Model

### 1.1 External dependency failure
- 风险：通知器（`IXcmNotifier`）不可用、返回 `false` 或 revert。
- 缓解：
  - 默认 `strictXcm=false`，不阻断提款资金流；
  - 失败通知进入 `NotifyStatus.FAILED`，可通过 `retryNotify` 补偿；
  - 可切换 `strictXcm=true` 进入强一致模式。

### 1.2 Misconfigured assets/params
- 风险：恶意 token、异常长 duration、超大 deposit 造成风险敞口。
- 缓解：
  - `tokenAllowlist` 白名单；
  - `maxDuration` 上限；
  - `maxDepositPerStream` 上限；
  - 所有敏感参数受 `onlyOwner` 限制。

### 1.3 Privilege compromise
- 风险：治理私钥泄露导致参数被恶意修改。
- 缓解：
  - `Ownable2Step` 两步治理移交流程；
  - 建议 owner 使用多签；
  - 所有治理参数调整均有链上事件追踪。

### 1.4 Commercial activation mismatch
- 风险：服务还没开始，流却错误进入计费；或者 provider 长时间不启动服务导致 buyer 资金被锁。
- 缓解：
  - 引入 `PENDING -> ACTIVE` 生命周期，创建流不等于开始计费；
  - 通过 `triggerPolicy` 明确谁有权启动服务；
  - `activationDeadline` 到期后可 `expirePendingStream` 退款；
  - `cancelBeforeActivation` 提供未开服前的全额退款路径。

### 1.5 Provider plan abuse / mismatch
- 风险：buyer 与 provider 线下约定不一致，或 buyer 传入超出 provider 接受范围的 deposit / duration。
- 缓解：
  - provider 先发布 `ServicePlan`；
  - `createPendingStreamFromPlan` 强制校验 `min/max deposit` 和 `min/max duration`；
  - `termsHash` 绑定 provider 侧条款版本；
  - `serviceRef` 绑定具体订单或服务引用，便于后续审计。

## 2. Failure Recovery Runbook

### 2.1 Notifier 异常（常见）
1. 保持 `strictXcm=false`（避免提款停摆）。
2. 排查 notifier 实现和依赖（precompile、RPC）。
3. 修复 notifier 后，批量执行 `retryNotify(streamId, withdrawId)`。
4. 观察 `NotifyStatus` 从 `FAILED -> SUCCESS`。

### 2.2 严格模式下提款回滚
1. 暂时 `setStrictXcm(false)` 降级可用性。
2. 修复 notifier 健康问题。
3. 对失败提款重新发起提现或补偿重试。
4. 验证稳定后再切回 `strictXcm(true)`（如业务要求）。

### 2.3 Token 风险处理
1. 立刻 `setTokenAllowlist(token, false)` 禁止新建流。
2. 通知前端禁用该 token。
3. 评估已有流处理方案（取消/迁移/回收）。

### 2.4 Pending stream 未启动
1. 先读取 `getStreamCommercialState(streamId)` 确认仍为 `PENDING`。
2. 判断问题属于：
   - provider 尚未就绪
   - 双边确认未完成
   - operator 未触发
   - `activationDeadline` 已过
3. 若服务不再继续，sender 调用 `cancelBeforeActivation(streamId)`。
4. 若 deadline 已过，任何人都可调用 `expirePendingStream(streamId)` 执行退款。

## 3. Governance Operations

### 3.1 Key controls
- `setNotifier(address)`
- `setStrictXcm(bool)`
- `setTokenAllowlist(address,bool)`
- `setMaxDuration(uint256)`
- `setMaxDepositPerStream(uint256)`
- `setServicePlanRegistry(address)`

### 3.2 Provider-owned commercial controls
- `createServicePlan(...)`
- `updateServicePlan(...)`
- `setServicePlanActive(planId, bool)`

Provider controls:
- token acceptance
- deposit and duration bounds
- activation window
- trigger policy
- authorized operator
- commercial terms binding via `termsHash`

### 3.3 Ownership transfer
1. 当前 owner 调用 `transferOwnership(newOwner)`.
2. 新 owner 调用 `acceptOwnership()`.

### 3.4 Pre-deploy checklist
1. 运行 `HealthCheck.s.sol`，确保 notifier 与 precompile 配置可用。
2. 部署后立即配置 token allowlist。
3. 在前端验证 preflight 四项检查全部通过。

## 4. Residual Risks
- 通知重试是最终一致性方案，不保证单笔通知实时成功。
- 若治理账户失控，参数层面仍可能被恶意修改；建议多签和监控告警。
- `ServicePlan` 目前仍缺少前端 plan authoring / marketplace discoverability，provider 控制已在后端成立，但产品层还未完全露出。
