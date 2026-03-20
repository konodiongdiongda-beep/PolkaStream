# PolkaStream Agent MCP

Internal MCP stdio server for agent integration.

Positioning rules:
- This is an internal integration layer.
- It is not part of the external product positioning.
- Public framing remains:
  1. `Streaming Payments`
  2. `AI Agent Settlement` as flagship scenario
  3. `request-level batched settlement sidecar` as optional extension

## What it exposes

The server wraps two surfaces:
1. Direct onchain commercial stream actions on `PolkaStream`
2. API-mediated service trigger and settlement actions on `services/api`

Current tool groups:
- Runtime / wallet:
  - `get_runtime_config`
  - `get_token_allowance`
  - `approve_token_spend`
- Streaming core / commercial lifecycle:
  - `create_pending_stream`
  - `create_pending_stream_from_plan`
  - `confirm_ready_by_sender`
  - `confirm_ready_by_receiver`
  - `activate_stream`
  - `cancel_before_activation`
  - `get_stream_commercial_state`
  - `get_stream_plan_binding`
- ServicePlan:
  - `create_service_plan`
  - `update_service_plan`
  - `set_service_plan_active`
  - `get_service_plan`
  - `get_provider_plans`
- Service trigger / sidecar:
  - `get_service_trigger`
  - `upsert_service_trigger`
  - `trigger_service`
  - `post_usage_events`
  - `preview_settlement`
  - `submit_settlement`
  - `retry_settlement`
  - `get_payer_escrow`
  - `get_provider_claimable`

## Install

```bash
cd services/agent-mcp
pnpm install
```

## Run

```bash
cd services/agent-mcp
pnpm start
```

This server uses stdio and is meant to be spawned by an MCP-capable client.

Smoke test:

```bash
cd services/agent-mcp
pnpm smoke
```

## Environment

Required for direct chain tools:
- `POLKASTREAM_MCP_RPC_URL` or `NEXT_PUBLIC_RPC_URL`
- `POLKASTREAM_MCP_POLKASTREAM_ADDRESS` or `NEXT_PUBLIC_POLKASTREAM_ADDRESS`
- `POLKASTREAM_MCP_PRIVATE_KEY` or `PRIVATE_KEY`

Required for ServicePlan writes:
- `POLKASTREAM_MCP_SERVICE_PLAN_REGISTRY_ADDRESS` or `SERVICE_PLAN_REGISTRY_ADDRESS`
- If omitted, the server will try to read `servicePlanRegistry()` from `PolkaStream`

Required for API-mediated tools:
- `POLKASTREAM_MCP_API_BASE_URL`
- `POLKASTREAM_MCP_API_TOKEN` if API auth is enabled

Optional:
- `POLKASTREAM_MCP_USAGE_SETTLEMENT_HUB_ADDRESS`

## Example MCP client config

```json
{
  "mcpServers": {
    "polkastream": {
      "command": "node",
      "args": ["/absolute/path/to/PolkaStream/services/agent-mcp/server.mjs"],
      "env": {
        "POLKASTREAM_MCP_RPC_URL": "https://services.polkadothub-rpc.com/testnet",
        "POLKASTREAM_MCP_POLKASTREAM_ADDRESS": "0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D",
        "POLKASTREAM_MCP_SERVICE_PLAN_REGISTRY_ADDRESS": "0xYourRegistry",
        "POLKASTREAM_MCP_PRIVATE_KEY": "0x...",
        "POLKASTREAM_MCP_API_BASE_URL": "http://127.0.0.1:8787",
        "POLKASTREAM_MCP_API_TOKEN": "..."
      }
    }
  }
}
```

## Recommended flows

### Buyer agent
1. `get_provider_plans`
2. `get_service_plan`
3. `get_token_allowance`
4. `approve_token_spend`
5. `create_pending_stream_from_plan`
6. `get_stream_commercial_state`

### Provider agent
1. `create_service_plan`
2. `update_service_plan`
3. `set_service_plan_active`
4. `activate_stream` or `confirm_ready_by_receiver`

### Operator agent
1. `get_service_trigger`
2. `upsert_service_trigger`
3. `trigger_service`
4. `post_usage_events`
5. `preview_settlement`
6. `submit_settlement`
7. `retry_settlement`

## Interop notes

- `serviceRef` and `termsHash` accept raw strings or `bytes32`.
- Raw strings are normalized to `bytes32` with SHA-256 inside the MCP adapter so they stay compatible with the API/BFF service trigger layer.
- For large integer inputs, pass decimal strings instead of JSON numbers.
- `approve_token_spend` is required before a buyer can create a stream funded with ERC20.
