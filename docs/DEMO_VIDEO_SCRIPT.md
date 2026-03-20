# Demo Video Script and Storyboard

Last updated: `2026-03-20`

Target length: `105-125 seconds`

This version is optimized for:
- public submission video
- MiniMax English voiceover
- screen recording without live talking

## 1. Current Demo Boundary

### Main submission video: public-safe only
Use only what is already public-safe and verifiable on the current testnet deployment:
- live console
- streaming core
- `createStream`
- `withdraw`
- `pause / resume / cancel`
- `retryNotify`
- AI settlements page as a secondary extension view
- deployment evidence

### Do not put these into the main public submission video unless you re-deploy and re-verify first
- `Pending Stream`
- `ServicePlan`
- `activateStream`
- MCP / skill-driven commercial flow

If the control panel shows multiple create modes, keep `Immediate` selected in the public video.

## 2. Recording Setup

- Use `https://polkastream-console.vercel.app`
- Keep wallet pre-connected before recording
- Keep browser zoom at `100%` or `110%`
- Open these tabs in advance:
  1. live console
  2. repo deployment evidence
  3. security review
- Prepare one token allowlisted wallet state
- If possible, prepare one stream example before recording
- Disable desktop notifications
- Move the cursor slowly and avoid over-scrolling

## 3. Safe Asset Order

1. live console hero shot
2. create stream in `Immediate` mode
3. streams page
4. withdraw action
5. failed notify + retry flow
6. AI settlements page
7. deployment evidence page
8. return to product for closing shot

## 4. Main Storyboard

### Scene 1

Time:
- `0:00 - 0:08`

Visual:
- open the live console
- keep project name, wallet state, and testnet state visible

On-screen caption:
- `PolkaStream`
- `Streaming payments on Polkadot Hub EVM`

Voiceover:
- `This is PolkaStream, a stablecoin streaming payments protocol built on Polkadot Hub EVM.`
- `Our core product is onchain streaming payments, and AI Agent Settlement is the flagship scenario we use to demonstrate it.`

Operator notes:
- start on the real product, not a title card

### Scene 2

Time:
- `0:08 - 0:20`

Visual:
- stay on dashboard
- hover over stream metrics and environment indicators

On-screen caption:
- `Continuous services need continuous payments`

Voiceover:
- `Many digital services are becoming more real-time, but payments are still often upfront, one-off, or manually reconciled.`
- `That creates a mismatch between how services run and how money moves.`

Operator notes:
- keep this section short

### Scene 3

Time:
- `0:20 - 0:42`

Visual:
- open `Create Stream`
- if multiple create modes appear, keep `Immediate` selected
- show receiver, token, deposit, duration, and cliff
- submit one stream or show a prepared ready-to-submit state

On-screen caption:
- `Lock budget once`
- `Release value continuously`

Voiceover:
- `Here, a payer creates a stablecoin stream by selecting the receiver, token, deposit, duration, and optional cliff.`
- `Once the stream is created, funds are locked in the contract and released linearly over time.`
- `This makes the payment flow programmable, visible, and verifiable onchain.`

Operator notes:
- if wallet confirmation is slow, cut after confirmation and continue on the updated stream list

### Scene 4

Time:
- `0:42 - 0:58`

Visual:
- go to `Streams`
- show the new or existing stream row
- point at deposit, claimable amount, balance, and status

On-screen caption:
- `Live stream state`
- `withdraw / pause / resume / cancel`

Voiceover:
- `On the stream page, we can see the live state of the payment flow.`
- `The receiver can withdraw accrued value in real time, while the sender can pause, resume, or cancel depending on state.`

Operator notes:
- keep the row readable

### Scene 5

Time:
- `0:58 - 1:18`

Visual:
- show `Withdraw`
- if available, also show a failed notify record and press `Retry Notify`

On-screen caption:
- `Withdraw in real time`
- `Retry failed notify`

Voiceover:
- `The receiver can withdraw against live onchain state instead of waiting for a coarse payout cycle.`
- `We also built retryable notifier recovery, so a failed notify can be handled explicitly instead of becoming an invisible edge case.`

Operator notes:
- this is one of the strongest proof moments in the whole video

### Scene 6

Time:
- `1:18 - 1:34`

Visual:
- open `AI Settlements`
- show batched windows, claimable balance, and API or hub status

On-screen caption:
- `Flagship scenario`
- `AI Agent Settlement`

Voiceover:
- `AI Agent Settlement is our flagship scenario.`
- `On top of the streaming core, we also built an optional batched settlement sidecar for higher-frequency AI usage.`
- `This extends the architecture without changing the core product identity.`

Operator notes:
- do not overstay here
- this is an extension view, not the primary story

### Scene 7

Time:
- `1:34 - 1:50`

Visual:
- open the repo deployment evidence page
- keep contract address and testnet proof visible

On-screen caption:
- `Live on Polkadot Hub Testnet`
- `Deployment evidence archived`

Voiceover:
- `Today, PolkaStream is live on Polkadot Hub Testnet with deployment evidence, a working frontend console, contract tests, invariant tests, and an internal security review.`

Operator notes:
- hold the screen long enough to read the proof

### Scene 8

Time:
- `1:50 - 2:00`

Visual:
- return to the live console
- end on dashboard or streams page

On-screen caption:
- `Streaming payments first`
- `AI Agent Settlement as flagship scenario`

Voiceover:
- `PolkaStream shows how Polkadot can support a more programmable payment rail for continuous digital services and AI agents.`
- `Thank you. This is PolkaStream.`

Operator notes:
- end on product, not on documentation

## 5. Main Voiceover Script

Use this block directly in MiniMax:

`This is PolkaStream, a stablecoin streaming payments protocol built on Polkadot Hub EVM. Our core product is onchain streaming payments, and AI Agent Settlement is the flagship scenario we use to demonstrate it. Many digital services are becoming more real-time, but payments are still often upfront, one-off, or manually reconciled. That creates a mismatch between how services run and how money moves. Here, a payer creates a stablecoin stream by selecting the receiver, token, deposit, duration, and optional cliff. Once the stream is created, funds are locked in the contract and released linearly over time. This makes the payment flow programmable, visible, and verifiable onchain. On the stream page, we can see the live state of the payment flow. The receiver can withdraw accrued value in real time, while the sender can pause, resume, or cancel depending on state. The receiver can withdraw against live onchain state instead of waiting for a coarse payout cycle. We also built retryable notifier recovery, so a failed notify can be handled explicitly instead of becoming an invisible edge case. AI Agent Settlement is our flagship scenario. On top of the streaming core, we also built an optional batched settlement sidecar for higher-frequency AI usage. This extends the architecture without changing the core product identity. Today, PolkaStream is live on Polkadot Hub Testnet with deployment evidence, a working frontend console, contract tests, invariant tests, and an internal security review. PolkaStream shows how Polkadot can support a more programmable payment rail for continuous digital services and AI agents. Thank you. This is PolkaStream.`

## 6. Subtitle Pack

Use only short subtitles:
1. `Streaming payments on Polkadot Hub EVM`
2. `Lock budget once`
3. `Release value continuously`
4. `Withdraw in real time`
5. `Retry failed notify`
6. `AI Agent Settlement`
7. `Live on Polkadot Hub Testnet`

## 7. Optional Appendix: Skill / MCP Demo

Only record this after the main video, and only if the latest deployment is re-verified.

Suggested appendix order:
1. open terminal
2. show MCP runtime config
3. show `get_provider_plans`
4. show `get_service_plan`
5. show `approve_token_spend`
6. show `create_pending_stream_from_plan`
7. show `get_stream_commercial_state`

Appendix voiceover:
- `Beyond the public demo surface, PolkaStream also includes an MCP adapter for agent-native execution.`
- `This lets an agent reason in terms of business actions instead of raw ABI calls.`

Do not combine this appendix with the main submission cut unless the latest contract stack is also publicly proven.

## 8. Recording Checklist

- wallet pre-connected
- correct testnet selected
- immediate mode selected for the public-safe cut
- one stream example prepared
- repo proof tab ready
- security review tab ready
- MiniMax voiceover generated first
- no desktop notifications
- every key screen visible for at least `3-4 seconds`
