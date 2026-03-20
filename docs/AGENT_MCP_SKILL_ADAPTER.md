# Agent MCP / Skill Adapter

Last updated: `2026-03-20`

## 1. Purpose

This document defines the internal adapter layer that lets an MCP-capable agent call PolkaStream for real.

This layer exists to solve one problem only:
- convert agent intent into real chain/API operations

This layer is **not** part of PolkaStream's public product story.

## 2. Adapter Boundary

The adapter wraps two execution paths:
1. direct onchain execution against `PolkaStream`
2. HTTP execution against `services/api`

That means an agent does not need to understand:
- ABI details
- raw JSON-RPC
- BFF endpoint quirks
- request/response normalization for `serviceRef` or `termsHash`

## 3. Current Implementation

Reference implementation:
- `services/agent-mcp/server.mjs`

Package manifest:
- `services/agent-mcp/package.json`

Operational notes:
- transport: `stdio`
- protocol: MCP via official TypeScript SDK
- runtime: Node.js >= 18
- output mode: JSON text + structured content

## 4. Tool Surface

### 4.1 Runtime / wallet
- `get_runtime_config`
- `get_token_allowance`
- `approve_token_spend`

### 4.2 Commercial stream lifecycle
- `create_pending_stream`
- `create_pending_stream_from_plan`
- `confirm_ready_by_sender`
- `confirm_ready_by_receiver`
- `activate_stream`
- `cancel_before_activation`
- `get_stream_commercial_state`
- `get_stream_plan_binding`

### 4.3 Provider-owned ServicePlan
- `create_service_plan`
- `update_service_plan`
- `set_service_plan_active`
- `get_service_plan`
- `get_provider_plans`

### 4.4 API-mediated trigger / settlement
- `get_service_trigger`
- `upsert_service_trigger`
- `trigger_service`
- `post_usage_events`
- `preview_settlement`
- `submit_settlement`
- `retry_settlement`
- `get_payer_escrow`
- `get_provider_claimable`

## 5. Normalization Rules

### 5.1 Integer inputs

All onchain amounts and durations should be passed as decimal strings when values may exceed JS safe integer range.

### 5.2 `serviceRef` and `termsHash`

Rules:
- if caller provides `bytes32`, the adapter passes it through unchanged
- if caller provides a raw string, the adapter hashes it to `bytes32`
- current adapter uses `SHA-256` for this normalization so it stays consistent with the BFF `service trigger` layer

Implication:
- if the stream will later be checked by `services/api`, prefer using the adapter or precomputed `SHA-256 bytes32`
- do not mix arbitrary hashing conventions across clients

## 6. Agent Role Mapping

### 6.1 Buyer agent

Primary path:
1. inspect provider plans
2. check ERC20 allowance
3. approve token spend
4. create pending stream from plan
5. watch commercial state

### 6.2 Provider agent

Primary path:
1. publish plan
2. tune bounds and trigger policy
3. activate plan / deactivate plan
4. activate or confirm receiver readiness when service is actually available

### 6.3 Operator agent

Primary path:
1. register or inspect service trigger
2. activate pending stream on first valid request
3. post usage events
4. preview/submit/retry settlement windows

## 7. What This Makes Real Today

This adapter means at least one class of agent can now do real work end-to-end:
- provider agent can publish a `ServicePlan`
- buyer agent can approve ERC20 + fund a pending stream from that plan
- operator agent can trigger activation via API

So the repository now has:
- a written Agent Integration Spec
- a callable MCP surface
- a provider-controlled ServicePlan path

## 8. Current Limits

1. This is still a single-signer adapter today.
2. Frontend plan authoring is not finished yet.
3. Plan discovery is currently contract/MCP based; there is no public marketplace index yet.
4. The adapter is an internal integration interface, not a public feature promise.
