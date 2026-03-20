# Pitch Deck Outline

Target length: `6 slides`

Use this deck for Demo Day and as the optional deck in the submission package.

## Slide 1. Title

Title:
- `PolkaStream`

Subtitle:
- `Stablecoin streaming payments on Polkadot Hub EVM`

Support line:
- `Flagship demo scenario: AI Agent Settlement`

What to show:
- Product name
- One-line definition
- Live console URL

## Slide 2. Problem

Headline:
- `Digital services became real-time. Payments did not.`

Body:
- Many digital services still rely on upfront payment, one-off transfers, or manual reconciliation.
- That creates poor budget control and weak automation for continuous services.
- This becomes more obvious in AI services, where agents may need to pay continuously for usage.

## Slide 3. Core Solution

Headline:
- `Lock budget once. Release value continuously onchain.`

Body:
- Payer creates a stablecoin stream.
- Value unlocks linearly over time.
- Receiver withdraws against live onchain state.
- Sender can pause, resume, or cancel.
- Failed notify flows can be retried.

What to show:
- `createStream -> withdraw -> retryNotify`

## Slide 4. Why This Matters for AI

Headline:
- `AI Agent Settlement is the strongest demo scenario`

Body:
- AI agents increasingly need to procure digital services with tighter budget control.
- Streaming payments give them a cleaner way to settle continuous service relationships.
- We also built a batched sidecar for request-level AI usage when traffic becomes high frequency.

Important note:
- Keep this slide as `scenario`, not `main product identity`.

## Slide 5. Architecture and Proof

Headline:
- `Stream core first. Batched sidecar second.`

Body:
- `PolkaStream.sol`: core streaming payments protocol
- `UsageSettlementHub.sol`: optional batched settlement sidecar
- frontend console live on testnet
- deployment evidence archived in repo
- contract tests, invariant tests, internal security review completed

What to show:
- one simple architecture diagram
- one testnet deployment proof block

## Slide 6. Current Status and Closing

Headline:
- `Live on Polkadot Hub Testnet`

Body:
- streaming core is deployed and demoable
- sidecar extension is implemented
- frontend console is live
- next work is production hardening, rehearsal, and external diligence

Closing line:
- `PolkaStream shows how Polkadot can support a more programmable payment rail for digital services and AI agents.`

## Speaker Rule

If time is tight:
1. Spend most time on Slides `2`, `3`, and `6`.
2. Keep Slide `4` short.
3. Do not turn Slide `5` into a deep technical lecture.
