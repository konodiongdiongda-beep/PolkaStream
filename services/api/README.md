# PolkaStream BFF API

HTTP API that powers `/v1/*` for settlement and monitoring.

## Setup

```bash
cd services/api
pnpm install
```

## Run

```bash
node services/api/server.mjs --host 0.0.0.0 --port 8787
```

## Auth & Tenancy

Supports **API Key** or **JWT**:

- API Key: `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`
- JWT: `Authorization: Bearer <jwt>` (HS256)

Scopes are enforced per endpoint (e.g. `usage.write`, `settlement.submit`).

### Bootstrap tenant + keys

```bash
node services/api/admin.mjs create-tenant --id demo --name "Demo Tenant"
node services/api/admin.mjs create-api-key --tenant demo --name "default" --scopes "usage.write,settlement.preview,settlement.submit,settlement.retry,metrics.read,audit.read,escrow.read,claimable.read,service.read,service.write,service.trigger"
```

## Idempotency

Use `Idempotency-Key` header (or `idempotencyKey` in JSON body) for:
- `POST /v1/usage-events`
- `POST /v1/settlement/submit`
- `POST /v1/services/:serviceId/trigger` (uses `requestId` / `Idempotency-Key` as idempotency key)

Repeated requests with the same key return the first response. Different payloads with the same key return `409`.

## Storage

Uses SQLite by default (file DB). For Postgres, set `API_DATABASE_URL`.
All tables + indexes are created automatically on boot.

## Endpoints

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
- `GET /v1/settlement/metrics?from=<ts>&to=<ts>`
- `GET /v1/settlement/audit?from=<ts>&to=<ts>&payer=&provider=&token=&windowSeconds=&format=json|csv`
- `GET /v1/payers/:address/escrow?token=<address>`
- `GET /v1/providers/:address/claimable?token=<address>`

## Environment variables

See `.env.example` for full list. Key ones:

- `API_DATABASE_URL` (Postgres) or `API_DB_PATH` (SQLite)
- `API_KEY_HASH_SALT` (API key hashing salt)
- `API_JWT_SECRET` / `API_JWT_ISSUER` / `API_JWT_AUDIENCE`
- `API_RATE_LIMIT_GLOBAL_PER_MIN`, `API_RATE_LIMIT_TENANT_PER_MIN`
- `API_ALLOWLIST_ENFORCE`, `API_ALLOWLIST_ENFORCE_KINDS`
- `API_MAX_EVENTS_PER_REQUEST`, `API_MAX_EVENT_AMOUNT_WEI`, `API_MAX_TOTAL_AMOUNT_WEI`
- `NEXT_PUBLIC_POLKASTREAM_ADDRESS`, `STREAM_TRIGGER_PRIVATE_KEY`, `STREAM_TRIGGER_OPERATOR_ADDRESS`
- `API_CAST_BIN` if `cast` is not on the default `$PATH`

## Commercial Trigger Flow

### 1. Register a service trigger

```bash
curl -X PUT "$API_BASE_URL/v1/services/openclaw-chat" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "42",
    "provider": "0x0000000000000000000000000000000000000b0b",
    "triggerMode": "on_request",
    "expectedTriggerPolicy": "AUTHORIZED_OPERATOR",
    "serviceRef": "openclaw-chat-v1",
    "metadata": {
      "route": "/v1/chat/completions"
    }
  }'
```

Notes:
- `serviceRef` can be a raw string or a `bytes32`; raw strings are hashed to `bytes32` before comparison.
- The onchain stream should already be a `PENDING` stream.
- For automated activation, the stream should typically use `AUTHORIZED_OPERATOR` and set `authorizedActivator` to the server operator address.

### 2. Trigger activation on the first real request

```bash
curl -X POST "$API_BASE_URL/v1/services/openclaw-chat/trigger" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req-2026-03-20-0001",
    "metadata": {
      "customerId": "cust-17",
      "path": "/v1/chat/completions"
    }
  }'
```

If the stream is still `PENDING`, the BFF will call `activateStream(streamId)` and billing begins only after that activation succeeds onchain.

Governance & allowlist process: see `docs/API_GOVERNANCE.md`.
