# Weekly Metrics Report: weekly-2026w11

- GeneratedAtUTC: 2026-03-09T09:18:08Z
- Contract: 0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D
- BlockRange: 6181838 -> latest

| Metric | Value |
| --- | ---: |
| Streams Created | 0 |
| Withdraw Success Count | 0 |
| Withdraw Attempt Proxy | 0 |
| Withdraw Success Proxy Rate | 0.00% |
| Notify Attempts | 0 |
| Notify Failed | 0 |
| Notify Failure Rate | 0.00% |
| Retry Attempts | 0 |
| Retry Success | 0 |
| Retry Success Rate | 0.00% |

## Notes
- Withdraw Success Proxy Rate = Withdrawn events / NotifyStatusUpdated events with attempts=1.
- Notify Failure Rate = status=FAILED events / all NotifyStatusUpdated events.
- Retry Success Rate = attempts>1 and status=SUCCESS / all attempts>1 events.
