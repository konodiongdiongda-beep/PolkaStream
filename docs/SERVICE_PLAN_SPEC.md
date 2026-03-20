# ServicePlan Spec

Last updated: `2026-03-20`

## 1. Goal

`ServicePlan` makes provider-side control real before the buyer funds anything.

Instead of only supporting:
- buyer creates arbitrary stream

PolkaStream now also supports:
1. provider publishes commercial envelope
2. buyer funds against that envelope
3. stream stays `PENDING`
4. activation happens only when the configured trigger condition is satisfied

## 2. Current Contracts

Primary files:
- `contracts/PolkaStreamServicePlanRegistry.sol`
- `contracts/interfaces/IPolkaStreamServicePlanRegistry.sol`
- `contracts/PolkaStream.sol`

Tests:
- `test/PolkaStreamServicePlanRegistry.t.sol`

## 3. Data Model

Each `ServicePlan` contains:
- `planId`
- `provider`
- `token`
- `minDeposit`
- `maxDeposit`
- `minDuration`
- `maxDuration`
- `cliffInSeconds`
- `activationWindow`
- `triggerPolicy`
- `authorizedActivator`
- `termsHash`
- `isActive`

## 4. Control Boundary

This is the key business rule:
- provider controls the envelope
- buyer controls whether to fund within that envelope

Provider-controlled fields:
- accepted token
- deposit range
- duration range
- post-activation cliff
- activation window
- trigger policy
- authorized operator
- offchain commercial terms binding

Buyer-controlled fields:
- actual deposit, but only within bounds
- actual duration, but only within bounds
- actual service order reference (`serviceRef`)

## 5. Stream Inheritance Rules

When buyer calls `createPendingStreamFromPlan(planId, deposit, durationInSeconds, serviceRef)`:
- receiver becomes `provider`
- token is inherited from the plan
- `cliffInSeconds` is inherited from the plan
- `activationDeadline` becomes `block.timestamp + activationWindow` when window is set
- `triggerPolicy` is inherited from the plan
- `authorizedActivator` is inherited from the plan
- `termsHash` is bound to the stream via `streamPlanTermsHash`

That means provider-side commercial terms stay attached to the resulting stream.

## 6. Validation Rules

Plan creation/update enforces:
- token must not be zero
- `minDeposit > 0`
- `maxDeposit >= minDeposit`
- `minDuration > 0`
- `maxDuration >= minDuration`
- `triggerPolicy` must be inside supported commercial trigger range
- `AUTHORIZED_OPERATOR` requires non-zero `authorizedActivator`
- non-operator policies must not carry an activator

Plan-based stream creation enforces:
- registry must be configured on `PolkaStream`
- plan must exist
- plan must be active
- buyer deposit must stay inside `[minDeposit, maxDeposit]`
- buyer duration must stay inside `[minDuration, maxDuration]`

## 7. Lifecycle

### 7.1 Provider side
1. provider creates plan
2. provider updates plan if needed
3. provider can disable plan by `setServicePlanActive(planId, false)`

### 7.2 Buyer side
1. buyer inspects plan
2. buyer approves ERC20
3. buyer creates `PENDING` stream from plan
4. escrow is funded immediately
5. billing does not start yet

### 7.3 Activation side
- `SENDER_ONLY`: sender starts service
- `RECEIVER_ONLY`: provider starts service
- `EITHER_PARTY`: either side starts service
- `BOTH_PARTIES`: both sides confirm readiness first
- `AUTHORIZED_OPERATOR`: designated operator starts service

## 8. What Is Already Done

Implemented and tested today:
- provider-owned plan registry contract
- plan create / update / activate-deactivate
- `PolkaStream.setServicePlanRegistry(...)`
- `createPendingStreamFromPlan(...)`
- `getStreamPlanBinding(...)`
- plan-bound `termsHash`
- plan-bound trigger semantics
- out-of-range / inactive / operator-only tests

So from backend semantics, provider control is already established.

## 9. What Is Not Finished Yet

Still missing or partial:
- frontend plan creation/editing UX
- plan discovery/indexing layer for public browsing
- richer plan metadata URI or marketplace presentation
- broader API endpoints dedicated to plan search/filtering

These are product/distribution gaps, not core contract-semantic gaps.

## 10. Practical Consequence

This changes the commercial answer to the user's earlier concern.

Before:
- creating a stream could look like “payment starts too early”

Now:
- provider can set the service envelope first
- buyer can lock budget without starting billing
- actual billing starts only after explicit activation

That is the correct direction for real commercial usage.
