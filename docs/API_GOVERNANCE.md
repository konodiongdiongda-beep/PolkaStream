# API Governance & Production Config

This document defines how the BFF API is configured and governed in production.

## Config Sources

Priority order (highest wins):
1. Runtime env vars (secrets manager / CI)
2. `.env`/shell exports
3. Defaults in `services/api/config.mjs`

Key env groups:
- **Chain**: `RPC_URL`, `USAGE_SETTLEMENT_HUB_ADDRESS`
- **Commercial trigger**: `NEXT_PUBLIC_POLKASTREAM_ADDRESS`, `STREAM_TRIGGER_PRIVATE_KEY`, `STREAM_TRIGGER_OPERATOR_ADDRESS`, `API_CAST_BIN`
- **Auth**: `API_KEY_HASH_SALT`, `API_JWT_SECRET`, `API_JWT_ISSUER`, `API_JWT_AUDIENCE`
- **DB**: `API_DATABASE_URL` (Postgres) or `API_DB_PATH` (SQLite)
- **Safety**: `API_RATE_LIMIT_*`, `API_CIRCUIT_*`, `API_MAX_*`
- **Allowlist**: `API_ALLOWLIST_ENFORCE`, `API_ALLOWLIST_ENFORCE_KINDS`

## Secrets & Key Rotation

- Store `API_KEY_HASH_SALT` and `API_JWT_SECRET` in the secrets manager.
- Rotate API keys by issuing new keys and revoking old ones.
- Rotate JWT secret with a staged deploy to avoid downtime.
- Prefer a dedicated `STREAM_TRIGGER_PRIVATE_KEY` for service activation instead of reusing the settlement submit key.
- When using `AUTHORIZED_OPERATOR`, the server operator address must match the onchain `authorizedActivator`.

CLI:
```bash
node services/api/admin.mjs create-api-key --tenant <tenant> --name <name> --scopes <scopes>
node services/api/admin.mjs revoke-api-key --id <key_id>
```

Recommended scopes for commercial trigger flows:
- `service.write`: register/update service to stream bindings
- `service.read`: inspect onchain commercial state and stored service config
- `service.trigger`: allow the runtime service to activate a pending stream on the first real request

## Allowlist Governance

### Scope
Allowlists apply per tenant and per kind:
- `token` (settlement token)
- `payer`
- `provider`

### Change process
1. Submit change request (CR) with tenant, kind, value, and rationale.
2. Security review approves CR.
3. Apply change via CLI and record `--by` actor.
4. Verify in audit logs (DB `allowlist` + `risk_events`).

CLI:
```bash
node services/api/admin.mjs allowlist add --tenant <tenant> --kind token --value <address> --by <operator>
node services/api/admin.mjs allowlist remove --tenant <tenant> --kind token --value <address>
```

## Risk & Rate Limits

- **Rate limits** are enforced globally and per tenant.
- **Circuit breaker** blocks tenants when error thresholds are exceeded.
- **Usage thresholds** block abnormally large batches.

Tune via:
- `API_RATE_LIMIT_GLOBAL_PER_MIN`
- `API_RATE_LIMIT_TENANT_PER_MIN`
- `API_CIRCUIT_ERROR_THRESHOLD`
- `API_CIRCUIT_WINDOW_SECONDS`
- `API_CIRCUIT_COOLDOWN_SECONDS`
- `API_MAX_EVENTS_PER_REQUEST`
- `API_MAX_EVENT_AMOUNT_WEI`
- `API_MAX_TOTAL_AMOUNT_WEI`

## Auditability

- Raw usage events are stored in DB.
- Settlement submissions are recorded with tx hash + status.
- Service trigger registrations are stored in `service_triggers`.
- First-request activation attempts are recorded in `service_trigger_events`.
- Use `/v1/settlement/audit` to generate reconciliation reports by time window and party.
