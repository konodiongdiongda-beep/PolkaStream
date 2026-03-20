# Commercial Triggered Streams Architecture

Last updated: `2026-03-19`

## 1. Why the Current Model Is Not Enough

Current `PolkaStream.sol` semantics are strong for a pure streaming payment demo, but they are not yet ideal for a commercial service contract.

Current behavior:
- payer creates the stream
- deposit is transferred into escrow immediately
- if `cliffInSeconds = 0`, value starts accruing immediately
- receiver withdraws against accrued state

This creates a gap for real service commerce:
1. `purchase` and `service start` are often not the same moment
2. the provider may need to accept or schedule the service first
3. the payer may want to lock budget before the provider starts work
4. activation should be explicit and auditable
5. in many cases the provider should publish terms before the payer funds anything

## 2. Commercial Goal

Upgrade PolkaStream from:
- `pure stream funding`

to:
- `commercial service payment rail with pending, trigger, activation, and streaming settlement`

## 3. Recommended Product Model

External framing should still remain:
1. Core: `streaming payments`
2. Flagship scenario: `AI Agent Settlement`
3. Extension: `batched settlement sidecar`

But the commercial protocol model should become:
1. provider defines service terms
2. payer locks budget into a pending stream
3. one or more authorized actors confirm readiness
4. a trigger activates the stream
5. value starts accruing only after activation
6. receiver withdraws against active service time

## 4. Commercial Lifecycle

### 4.1 Service Plan layer

Provider should be able to publish a reusable service plan.

Example plan fields:
- `provider`
- `token`
- `ratePerSecond` or `price curve reference`
- `minimumDuration`
- `maximumDuration`
- `minimumDeposit`
- `activationWindow`
- `triggerPolicy`
- `metadataURI` or `termsHash`
- `isActive`

This solves the business need that:
- `the provider can set a flow`
- `the provider can set when and how service starts`
- `buyers fund against known terms, not informal chat`

### 4.2 Pending Stream layer

A payer should create a `pending stream`, not an immediately accruing stream.

Pending stream behavior:
- deposit moves into escrow immediately
- no accrual starts yet
- withdrawal is disabled
- the stream is waiting for service activation

Minimum fields:
- `streamId`
- `sender`
- `receiver`
- `token`
- `deposit`
- `durationInSeconds`
- `cliffInSeconds`
- `createdAt`
- `activatedAt`
- `activationDeadline`
- `status`
- `triggerPolicy`
- `serviceRef`
- `authorizedActivator`

## 5. Status Machine

Recommended stream statuses:
- `PENDING`
- `ACTIVE`
- `PAUSED`
- `COMPLETED`
- `CANCELED`
- `EXPIRED`

Recommended transitions:
- `PENDING -> ACTIVE`
- `PENDING -> CANCELED`
- `PENDING -> EXPIRED`
- `ACTIVE -> PAUSED`
- `PAUSED -> ACTIVE`
- `ACTIVE -> CANCELED`
- `PAUSED -> CANCELED`
- `ACTIVE -> COMPLETED`

Important semantic rule:
- only `ACTIVE` streams accrue value

## 6. Trigger Model

This is the most important commercial upgrade.

A stream should not start accruing because it merely exists.
It should start accruing because an explicit trigger condition has been satisfied.

### 6.1 Trigger policy types

Recommended enum:
- `SENDER_ONLY`
- `RECEIVER_ONLY`
- `EITHER_PARTY`
- `BOTH_PARTIES`
- `AUTHORIZED_OPERATOR`

### 6.2 Meaning

- `SENDER_ONLY`
  - payer decides when service should begin
- `RECEIVER_ONLY`
  - provider decides when service actually begins
- `EITHER_PARTY`
  - whichever side is operationally first can start it
- `BOTH_PARTIES`
  - strongest confirmation model for higher-value services
- `AUTHORIZED_OPERATOR`
  - a trusted system actor or automation address can activate after offchain checks

### 6.3 Recommended default

For commercial services, the safest default is:
- `RECEIVER_ONLY` for provider-led services
- `BOTH_PARTIES` for higher-value contracts

## 7. Activation Semantics

### 7.1 Proposed contract methods

Core methods:
- `createPendingStream(...)`
- `activateStream(streamId)`
- `cancelBeforeActivation(streamId)`
- `expirePendingStream(streamId)`

Optional two-sided methods:
- `confirmReadyBySender(streamId)`
- `confirmReadyByReceiver(streamId)`
- `activateWhenReady(streamId)`

### 7.2 Activation formula

Current model:
- `startTime = createdAt + cliff`

Commercial model:
- `activatedAt = block.timestamp` when trigger succeeds
- `startTime = activatedAt + cliffInSeconds`

This preserves `cliff`, but moves it to the correct point in the lifecycle.

That means:
- order creation does not start billing
- service activation starts the billing schedule
- cliff becomes a post-activation grace period if needed

## 8. Provider-Set Flow

The provider should not only receive a stream.
The provider should be able to define the service envelope first.

Recommended pattern:
1. provider creates `ServicePlan`
2. payer creates `PendingStream` against that plan
3. provider accepts or activates when service begins
4. stream starts accruing from the activated state

This gives the provider control over:
- accepted token
- acceptable deposit range
- service duration bounds
- start/activation policy
- service metadata and terms

## 9. Service Delivery Hooks

For real commerce, a stream is not enough. We also need service-state hooks.

Recommended lightweight hooks:
- `serviceRef` or `termsHash`
- `serviceStartedAt`
- `serviceEndedAt` optional
- `operatorNoteHash` optional

These do not need full business logic onchain.
They only need enough information to make the payment lifecycle auditable.

## 10. Recommended Commercial Flow

### Flow A: Provider posts service plan

1. provider publishes `ServicePlan`
2. payer selects the plan
3. payer calls `createPendingStream`
4. escrow is funded, but accrual is still zero
5. provider starts service and calls `activateStream`
6. stream begins accruing
7. provider withdraws over time
8. sender can pause, resume, or cancel according to policy

### Flow B: Buyer initiates custom order

1. payer creates custom pending stream with service metadata
2. provider reviews order
3. provider accepts and activates
4. stream begins accruing only after acceptance

### Flow C: Two-sided confirmation

1. payer funds pending stream
2. receiver confirms readiness
3. sender confirms final go-live
4. `activateWhenReady` moves stream to active state

## 11. Trigger and Automation

Your earlier question about `trigger` should be answered like this in the product:

- `trigger` is not the same as recurring payment execution
- `trigger` means the event that changes the stream from `PENDING` to `ACTIVE`
- after activation, accrual is automatic via time math
- `withdraw` is still a separate action

Recommended trigger sources:
- manual trigger by provider
- manual trigger by buyer
- automated trigger by authorized operator
- future oracle or offchain attestation integration

## 12. Dispute and Safety Considerations

Minimal commercial safety features:
- `activationDeadline`: if the provider never starts, payer can recover escrow
- `cancelBeforeActivation`: full refund path before service starts
- `both-party trigger` for higher-value deals
- `termsHash` to bind the stream to an offchain commercial agreement
- optional operator allowlist for enterprise workflows

## 13. Minimal Upgrade Path

To keep implementation realistic, split the work into two phases.

### Phase 1: Triggered Pending Streams

Add to the current core protocol:
- `PENDING` status
- `activatedAt`
- `activationDeadline`
- `triggerPolicy`
- `authorizedActivator`
- `createPendingStream`
- `activateStream`
- `cancelBeforeActivation`
- `expirePendingStream`

This is the highest-value upgrade.

### Phase 2: Provider Service Plans

Add a reusable offer layer:
- `ServicePlan` struct
- `createPlan / updatePlan / disablePlan`
- `createPendingStreamFromPlan(planId, ...)`
- plan-level trigger policy and service terms

This turns the protocol from pure payment primitive into a more commercial service rail.

## 14. Recommendation

If the goal is commercial credibility, the recommended protocol direction is:
- keep streaming payments as the settlement core
- add pending and activation semantics immediately
- add provider service plans next
- keep AI settlement as the strongest scenario, not the only scenario

Short version:
- `create stream` should become `lock budget`
- `activate stream` should become `service started`
- `withdraw` should become `claim accrued service value`
