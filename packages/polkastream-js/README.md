# polkastream-js

Lightweight SDK for PolkaStream BFF API (`/v1/*`).

## Install

```bash
npm i polkastream-js
```

## Usage

```ts
import { PolkaStreamClient } from "polkastream-js";

const client = new PolkaStreamClient({
  baseUrl: "https://api.example.com",
  apiKey: "your_api_key",
});

const health = await client.health();
const config = await client.config();
const state = await client.streamCommercialState(42);

await client.ingestUsageEvents({
  requestId: "req-1",
  payer: "0x0000000000000000000000000000000000000001",
  provider: "0x0000000000000000000000000000000000000002",
  token: "0x0000000000000000000000000000000000000003",
  usageUnits: "1200",
  unitPriceWei: "1000000000000",
  requestTs: Math.floor(Date.now() / 1000),
});

const preview = await client.settlementPreview();
const service = await client.upsertService("openclaw-chat", {
  streamId: 42,
  provider: "0x0000000000000000000000000000000000000002",
  triggerMode: "on_request",
  expectedTriggerPolicy: "AUTHORIZED_OPERATOR",
  serviceRef: "openclaw-chat-v1",
});

const trigger = await client.triggerService("openclaw-chat", {
  requestId: "req-1",
  metadata: { path: "/v1/chat/completions" },
});
```

## Notes

- Requires Node 18+ (fetch built-in).
- For private deployments set `API_AUTH_TOKEN` on the server and pass `apiKey` here.
- Supports both usage-settlement endpoints and commercial service-trigger endpoints.
