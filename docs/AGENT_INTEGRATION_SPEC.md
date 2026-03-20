# Agent Integration Spec

Last updated: `2026-03-20`

## 1. Purpose

This document defines how an autonomous agent integrates with PolkaStream without ambiguity.

PolkaStream exposes two payment rails:
1. `Streaming core`: onchain pending/active streaming payments on `PolkaStream`
2. `Usage sidecar`: request-level aggregation and batched settlement via BFF + daemon + `UsageSettlementHub`

External framing remains:
- Core: `streaming payments`
- Flagship scenario: `AI Agent Settlement`
- Optional extension: `request-level batched settlement sidecar`

## 2. Integration Modes

### 2.1 Direct onchain mode

Use when:
- the agent owns or controls a wallet
- payment creation must be trustless
- the agent can sign transactions directly

Main contract entrypoints:
- `createStream(receiver, deposit, durationInSeconds, cliffInSeconds, token)`
- `createPendingStream(receiver, deposit, durationInSeconds, cliffInSeconds, token, activationDeadline, triggerPolicy, authorizedActivator, serviceRef)`
- `createPendingStreamFromPlan(planId, deposit, durationInSeconds, serviceRef)`
- `activateStream(streamId)`
- `confirmReadyBySender(streamId)`
- `confirmReadyByReceiver(streamId)`
- `cancelBeforeActivation(streamId)`
- `withdraw(streamId)`
- `pauseStream(streamId)`
- `resumeStream(streamId)`
- `cancelStream(streamId)`
- `getStreamCommercialState(streamId)`
- `getStreamPlanBinding(streamId)`

Recommended for:
- buyer agents
- provider agents
- operator agents with explicit signing rights

### 2.2 API-mediated sidecar mode

Use when:
- the agent emits high-frequency request usage
- each request should not go onchain
- a tenant-scoped control plane is preferred

Main API endpoints:
- `GET /v1/health`
- `GET /v1/config`
- `GET /v1/streams/:streamId/commercial-state`
- `GET /v1/services/:serviceId`
- `PUT /v1/services/:serviceId`
- `POST /v1/services/:serviceId/trigger`
- `POST /v1/usage-events`
- `POST /v1/settlement/preview`
- `POST /v1/settlement/submit`
- `POST /v1/settlement/retry`
- `GET /v1/settlement/metrics`
- `GET /v1/settlement/audit`
- `GET /v1/payers/:address/escrow`
- `GET /v1/providers/:address/claimable`

Recommended for:
- API-calling service agents
- gateway agents
- routing agents
- usage metering agents

### 2.3 MCP / Skill mode

Use when:
- the host agent supports MCP tools
- you want a single integration surface instead of raw HTTP + raw chain calls
- the agent should reason in terms of business actions, not ABI details

Reference implementation in this repository:
- `services/agent-mcp/server.mjs`
- `services/agent-mcp/README.md`
- `docs/AGENT_MCP_SKILL_ADAPTER.md`

This mode wraps:
- direct chain actions for stream creation / activation / ServicePlan management
- HTTP API actions for usage ingestion, settlement preview/submit/retry, commercial-state reads, and service trigger operations

## 3. Agent Roles

### 3.1 Buyer agent

Responsibilities:
- discover a service plan
- lock budget into a pending stream
- optionally confirm readiness
- monitor budget and stop service if needed

Preferred path:
- direct onchain mode for `createPendingStreamFromPlan`
- API mode for monitoring and service-trigger registration if needed

### 3.2 Provider agent

Responsibilities:
- publish and maintain `ServicePlan`
- activate service when ready
- monitor claimable balance
- withdraw or claim revenue

Preferred path:
- direct onchain mode for plan creation/update and stream activation
- API mode for service trigger management and batched claim visibility

### 3.3 Operator agent

Responsibilities:
- activate streams for `AUTHORIZED_OPERATOR` policies
- trigger services on first valid request
- submit settlement windows
- retry failed settlement windows

Preferred path:
- API mode for service-trigger and usage settlement operations
- direct onchain mode only when the operator wallet is explicitly authorized

## 4. Commercial Stream Lifecycle

### 4.1 Immediate stream

Use only when billing should start immediately.

Flow:
1. agent calls `createStream`
2. escrow funds move onchain
3. stream is immediately `ACTIVE`
4. `owed` accrues after `startTime`
5. receiver withdraws over time

### 4.2 Pending commercial stream

Use for real service commerce.

Flow:
1. agent selects a provider or a `ServicePlan`
2. agent creates `PENDING` stream
3. escrow funds move onchain
4. no billing accrues yet
5. trigger condition is satisfied
6. `activateStream` moves stream to `ACTIVE`
7. billing starts from `activatedAt + cliffInSeconds`
8. receiver withdraws over time

## 5. Trigger Policies

Trigger policy codes must be interpreted exactly as follows:
- `1 = SENDER_ONLY`
- `2 = RECEIVER_ONLY`
- `3 = EITHER_PARTY`
- `4 = BOTH_PARTIES`
- `5 = AUTHORIZED_OPERATOR`

Operational meaning:
- `SENDER_ONLY`: buyer decides when service begins
- `RECEIVER_ONLY`: provider decides when service begins
- `EITHER_PARTY`: either side may start the stream
- `BOTH_PARTIES`: both sender and receiver must confirm readiness before activation
- `AUTHORIZED_OPERATOR`: only the configured operator may activate the stream

## 6. ServicePlan Model

ServicePlan exists to give the provider explicit control before funding happens.

Required plan fields:
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

ServicePlan rules:
- the provider creates and owns the plan
- the buyer creates a pending stream against a plan
- the stream inherits provider, token, cliff, trigger policy, activation window, and terms binding
- deposit and duration must remain inside the provider-defined bounds

## 7. Agent-Facing Actions

### 7.1 Streaming core actions

Buyer-side:
- `get_runtime_config`
- `get_token_allowance`
- `approve_token_spend`
- `create_pending_stream`
- `create_pending_stream_from_plan`
- `confirm_ready_by_sender`
- `pause_stream`
- `resume_stream`
- `cancel_before_activation`
- `cancel_stream`

Provider-side:
- `create_service_plan`
- `update_service_plan`
- `set_service_plan_active`
- `confirm_ready_by_receiver`
- `activate_stream`

Shared read actions:
- `get_stream_commercial_state`
- `get_stream_plan_binding`
- `get_service_plan`
- `get_provider_plans`

### 7.2 Sidecar settlement actions

- `upsert_service_trigger`
- `get_service_trigger`
- `trigger_service`
- `post_usage_events`
- `preview_settlement`
- `submit_settlement`
- `retry_settlement`
- `get_payer_escrow`
- `get_provider_claimable`

## 8. Auth Model

### 8.1 Onchain auth

Onchain actions are authorized by wallet ownership.

Expected wallets:
- buyer wallet
- provider wallet
- operator wallet

### 8.2 API auth

BFF supports:
- API key
- JWT
- optional legacy token

Required scopes by function family:
- `service.read`
- `service.write`
- `service.trigger`
- `usage.write`
- `settlement.preview`
- `settlement.submit`
- `settlement.retry`
- `metrics.read`
- `audit.read`
- `escrow.read`
- `claimable.read`

## 9. Idempotency Rules

The following operations must be idempotent from the agent point of view:
- `POST /v1/usage-events`
- `POST /v1/settlement/submit`
- `POST /v1/services/:serviceId/trigger`

Rules:
- the same idempotency key with the same payload returns the first response
- the same idempotency key with a different payload returns `409`
- agents must generate deterministic request ids for replay-sensitive operations

## 10. Risk Controls

The agent integration layer must expect and handle:
- rate limits
- circuit breaker blocks
- allowlist failures
- amount threshold blocks
- insufficient escrow on settlement submit
- service trigger policy mismatches
- onchain stream state mismatches

Agent fallback behavior should be:
1. stop retry storms on `429`
2. log and escalate `ALLOWLIST_BLOCKED`
3. top up escrow on `INSUFFICIENT_ESCROW`
4. re-read state on activation failure before retrying
5. treat `already_active` as success-equivalent for first-request triggers

## 11. Supported Reference Paths In This Repo

### 11.1 Provider-first service path

1. provider creates `ServicePlan`
2. buyer agent creates `PENDING` stream from plan
3. provider or operator activates the stream
4. provider withdraws streaming revenue over time

### 11.2 Request-level settlement path

1. service agent emits request usage
2. API authenticates and stores usage events
3. daemon or API aggregates settlement windows
4. `UsageSettlementHub` settles batched windows
5. provider claims batched revenue

### 11.3 First-request commercial trigger path

1. provider registers `serviceId -> streamId`
2. stream is still `PENDING`
3. first valid request hits `POST /v1/services/:serviceId/trigger`
4. API validates trigger policy and operator eligibility
5. API activates stream onchain
6. subsequent requests see `already_active`

## 12. What Is Supported Today vs Later

Implemented now:
- direct pending stream lifecycle onchain
- trigger policy enforcement onchain
- API-side service trigger registration and first-request activation
- sidecar usage ingestion and settlement batching
- MCP reference adapter that already covers buyer / provider / operator integration paths
- provider-side ServicePlan registry and plan-bound pending streams

Not yet fully generalized:
- agent-specific wallet custody abstraction
- multi-chain plan discovery
- oracle/attestation-based triggers
- dynamic price curves
- dispute arbitration beyond terms binding and deadlines

## 13. Public Messaging Boundary

Do not say:
- `any agent can just download a skill and instantly use everything`

Say instead:
- `Agents can integrate through direct contract calls, HTTP API, or the reference MCP adapter.`
- `The repository includes a concrete agent integration path, not only conceptual docs.`
