# METRICS: Runtime Dashboard

目标：周度追踪协议可用性和稳定性，支持复盘与治理决策。

## 1. Core KPIs

1. 创建数（Streams Created）
- 定义：时间窗口内 `StreamCreated` 事件数量。
- 用途：衡量采用趋势。

2. 提款成功率代理（Withdraw Success Proxy Rate）
- 定义：`Withdrawn` 事件数 / `NotifyStatusUpdated(attempts=1)` 事件数。
- 说明：链上无法直接统计所有 revert 的提款请求，因此使用事件代理指标识别异常偏差。

3. 通知失败率（Notify Failure Rate）
- 定义：`NotifyStatusUpdated(status=FAILED)` 数 / 通知总尝试数。
- 用途：衡量 notifier 和依赖链路健康。

4. 通知重试成功率（Retry Success Rate）
- 定义：`NotifyStatusUpdated(attempts>1,status=SUCCESS)` / `NotifyStatusUpdated(attempts>1)`。
- 用途：衡量补偿机制有效性。

## 2. Event Sources

- `StreamCreated`
- `Withdrawn`
- `NotifyStatusUpdated`
- `NotifyFailure`

建议按 `streamId`、`withdrawId` 做聚合键，避免重复计数。

## 3. Executable Export

周报导出脚本：`ops/metrics/export_weekly_metrics.sh`

```bash
# 示例：导出 6181838~latest 区间
ops/metrics/export_weekly_metrics.sh \
  --contract 0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D \
  --from-block 6181838 \
  --to-block latest \
  --label weekly-2026w11
```

输出文件：
- CSV: `ops/metrics/output/<label>.csv`
- Markdown: `ops/metrics/output/<label>.md`

## 4. Suggested Weekly Review Template

1. 本周总创建数与环比
2. 提款成功率代理与异常偏差
3. 通知失败率与 notifier 健康异常时段
4. retry 成功率与积压失败单量
5. 本周治理参数变更记录（notifier/strictXcm/allowlist/max params）
