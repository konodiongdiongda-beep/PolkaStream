# Judge Q&A Pack

Last updated: `2026-03-20`

This file is optimized for live Q&A.
Each answer includes:
- short English answer
- Chinese operator note
- wording to avoid

## 1. What exactly is PolkaStream?

English answer:
- `PolkaStream is a stablecoin streaming payments protocol on Polkadot Hub EVM.`
- `Our core product is onchain streaming payments, and AI Agent Settlement is the flagship scenario we use to demonstrate it.`

中文提示：
- 先讲主轴是 streaming payments，再讲 AI 是最强场景，不要反过来。

Avoid:
- `We are mainly an AI payments protocol.`

## 2. What problem are you solving?

English answer:
- `Many digital services already run in real time, but payments are still often upfront, one-off, or manually reconciled.`
- `We make payment flows continuous, programmable, and visible onchain.`

中文提示：
- 强调“服务实时化”和“支付粗粒度”之间的错配。

Avoid:
- 讲太大、太空的金融愿景。

## 3. Why streaming payments instead of normal transfers?

English answer:
- `Streaming payments improve budget control for continuous services.`
- `Instead of repeatedly sending funds, the payer locks budget once and the receiver withdraws against live accrued state.`

中文提示：
- 重点是“锁预算一次 + 连续释放 + 实时可见”。

## 4. Why Polkadot Hub EVM?

English answer:
- `Polkadot Hub EVM gives us a clean programmable environment for payment rails, testnet deployment, and integration with Polkadot-native infrastructure.`
- `It was a strong fit for a verifiable onchain payment protocol.`

中文提示：
- 不要泛泛讲“生态好”，要落到 payment rail 和 infra fit。

## 5. What is live today?

English answer:
- `The public testnet deployment already supports the streaming core: create, withdraw, pause, resume, cancel, and retry notify.`
- `We also have a live frontend console, deployment evidence, and an internal security review in the repo.`

中文提示：
- 回答要严格限定在“publicly verifiable today”。

Avoid:
- 把还没公开部署证明的新商业化接口说成 public-live。

## 6. Is this production-ready?

English answer:
- `No. The correct description today is demo-ready prototype, live on Polkadot Hub Testnet.`
- `We have deployment evidence and internal review, but we do not describe it as production-ready or fully audited.`

中文提示：
- 真实、克制，反而更可信。

## 7. What makes AI Agent Settlement a good scenario here?

English answer:
- `AI services are often continuous, automated, and budget-sensitive.`
- `That makes them a strong example of why continuous payment rails matter, even though streaming payments remain the core product.`

中文提示：
- AI 是 showcase，不是主身份。

## 8. How do you handle failures?

English answer:
- `We explicitly designed for failure recovery.`
- `If notifier delivery fails, the flow does not disappear into ambiguity. Failed notify records remain visible and can be retried.`

中文提示：
- 这是你很强的一点，讲“恢复路径”而不是只讲 happy path。

## 9. What about security?

English answer:
- `We completed contract tests, invariant tests, and an internal security review.`
- `We also documented residual risk clearly instead of overstating maturity.`

中文提示：
- 如果评委追问，补一句：`internal review, not third-party audit`。

Avoid:
- `audited` unless they explicitly ask and you qualify it as internal only.

## 10. What is the sidecar settlement system?

English answer:
- `It is an optional request-level batched settlement sidecar for higher-frequency AI usage.`
- `It is an extension around the core streaming rail, not the main protocol identity.`

中文提示：
- 一定要把它降到 extension，不然项目主轴又会漂。

## 11. Do you support commercial service flows, not just simple streams?

English answer:
- `Yes, the latest architecture includes a pending commercial flow with activation semantics and provider-controlled plan boundaries.`
- `But in the public-safe demo, we keep the focus on the already verified streaming core.`

中文提示：
- 这是最关键的一道边界题。要承认“架构有了”，但“公开主视频只演示已验证部分”。

## 12. What is your strongest differentiator?

English answer:
- `Clarity plus proof.`
- `The project is easy to understand in two minutes, but it also shows real deployment evidence, live contract actions, and failure recovery.`

中文提示：
- 你不是靠概念赢，是靠“解释清楚 + 真的能演示”。

## 13. What would you do next after the hackathon?

English answer:
- `We would finish the release freeze, rehearsal runbook, audit scope, and due diligence package before describing it as an operational product.`
- `On the product side, we would continue the commercial pending flow and agent integration path.`

中文提示：
- 用 `release freeze / rehearsal / audit scope / due diligence` 这些词，显得成熟。

## 14. How should judges remember PolkaStream?

English answer:
- `Streaming payments first.`
- `AI Agent Settlement as the flagship scenario.`
- `A clearer programmable payment rail on Polkadot Hub.`

中文提示：
- 这是最后一句收口话，反复用。
