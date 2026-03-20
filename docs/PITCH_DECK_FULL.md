# Pitch Deck Full Copy

Target length: `6 slides`

This version is meant to be used directly when you build the final PDF deck.

Main rule:
1. `Slide 1-3` must establish that PolkaStream is a streaming payments protocol
2. `Slide 4` introduces AI as the strongest scenario
3. `Slide 5` proves the system is real
4. `Slide 6` closes with current status, not overclaiming

## Slide 1

Slide title:
- `PolkaStream`

Slide subtitle:
- `Stablecoin streaming payments on Polkadot Hub EVM`

Support line:
- `Flagship demo scenario: AI Agent Settlement`

Slide body:
- `Lock budget once`
- `Release value continuously`
- `Withdraw against live onchain state`

Visual direction:
- Product name
- One clean UI screenshot from the live console
- Small footer with live console URL

Speaker notes:
- `PolkaStream is a stablecoin streaming payments protocol built on Polkadot Hub EVM.`
- `Our core product is onchain streaming payments. AI Agent Settlement is the strongest scenario we use to demonstrate why this matters.`

## Slide 2

Slide title:
- `Digital services became real-time. Payments did not.`

Slide body:
- `Many services still rely on upfront payment, one-off transfers, or manual reconciliation.`
- `That creates poor budget control for continuous digital services.`
- `This is increasingly visible in AI services, where usage is frequent, automated, and often latency-sensitive.`

Visual direction:
- Left side: short problem bullets
- Right side: one simple contrast graphic
  - `real-time service`
  - `coarse payment flow`

Speaker notes:
- `The problem is not abstract. Services increasingly run in real time, but payment systems still move in larger manual steps.`
- `That mismatch becomes painful when software, services, or agents need continuous budget control.`

## Slide 3

Slide title:
- `Lock budget once. Release value continuously onchain.`

Slide body:
- `Payer creates a stablecoin stream`
- `Value unlocks linearly over time`
- `Receiver withdraws against live state`
- `Sender can pause, resume, or cancel`
- `Failed notify flows can be retried`

Visual direction:
- Center flow:
  - `createStream`
  - `accrue`
  - `withdraw`
  - `retryNotify`
- Add one product screenshot from `Create Stream` or `Streams`

Speaker notes:
- `This is the core protocol.`
- `A payer locks budget once, value is released continuously, and the receiver can withdraw in real time.`
- `We also support pause, resume, cancel, and retryable notify recovery.`

## Slide 4

Slide title:
- `Why AI Agent Settlement is our flagship scenario`

Slide body:
- `AI agents increasingly need to procure digital services with tighter budget control`
- `Streaming payments fit continuous service relationships better than repeated manual transfers`
- `For higher-frequency usage, we also implemented a request-level batched settlement sidecar`

Visual direction:
- One clean diagram:
  - `Agent / buyer`
  - `Service provider`
  - `stream core`
  - `optional batched sidecar`

Speaker notes:
- `We do not position PolkaStream as a generic AI payments protocol.`
- `Instead, AI Agent Settlement is the strongest example of why continuous payment rails are useful.`
- `And when usage becomes very frequent, we can batch request-level settlement through a sidecar rather than pushing every request onchain.`

## Slide 5

Slide title:
- `Built, deployed, and verifiable`

Slide body:
- `Core contract deployed on Polkadot Hub Testnet`
- `Live frontend console`
- `Usage settlement sidecar implemented`
- `Contract tests and invariant tests completed`
- `Internal security review completed`
- `Deployment evidence archived in the repo`

Proof block:
- `PolkaStream contract: 0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D`
- `Testnet: Polkadot Hub EVM`
- `Live console: polkastream-console.vercel.app`

Visual direction:
- Left side: architecture or repo proof
- Right side: deployment evidence block

Speaker notes:
- `This is not only a concept.`
- `The core protocol is deployed, the console is live, and the sidecar flow is implemented.`
- `We also have deployment evidence, tests, and an internal security review in the repo.`

## Slide 6

Slide title:
- `PolkaStream shows a better payment rail for continuous digital services`

Slide body:
- `Core: streaming payments`
- `Flagship scenario: AI Agent Settlement`
- `Extension: request-level batched settlement sidecar`
- `Current status: live on Polkadot Hub Testnet`

Closing line:
- `PolkaStream shows how Polkadot can support programmable payment rails for digital services and AI agents.`

Visual direction:
- Return to one strong product screenshot
- Keep the closing line large and clean

Speaker notes:
- `The main takeaway is simple.`
- `PolkaStream starts with streaming payments as the product core.`
- `AI Agent Settlement is the strongest scenario we can demonstrate today, and the sidecar shows how the architecture can extend further without losing clarity.`

## Design Rules

Keep these rules when you export the deck:
1. No more than `3-5` bullets per slide
2. Only one main message per slide
3. Use product screenshots on Slides `1`, `3`, and `6`
4. Use proof instead of hype on Slide `5`
5. Do not write `production-ready`, `fully audited`, or `mainnet live`

## Fast Build Order

If you need the PDF quickly:
1. Build Slides `1`, `2`, `3`, `5`, `6` first
2. Add Slide `4` after the core deck is already coherent
3. Export to PDF and review once on a phone-sized screen
