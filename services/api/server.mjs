#!/usr/bin/env node
import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig, toSafeConfig } from "./config.mjs";
import { openDatabase, migrateDatabase } from "./db.mjs";
import { authenticateRequest, hasScope } from "./auth.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {
    host: undefined,
    port: undefined,
    dataDir: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--host") {
      out.host = argv[i + 1];
      i += 1;
    } else if (arg === "--port") {
      out.port = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--data-dir") {
      out.dataDir = argv[i + 1];
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      out.help = true;
    }
  }

  return out;
}

function usage() {
  console.log("Usage: node services/api/server.mjs [--host 0.0.0.0] [--port 8787] [--data-dir ./services/api/data]");
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const config = loadConfig();
if (args.host) config.host = args.host;
if (Number.isFinite(args.port)) config.port = args.port;
if (args.dataDir) {
  config.dataDir = path.resolve(args.dataDir);
  if (!process.env.API_DB_PATH) {
    config.dbPath = path.join(config.dataDir, "polkastream.db");
  }
}

const db = await openDatabase(config);
await migrateDatabase(db);

async function ensureDefaultTenant() {
  const tenant = await db.get("SELECT id FROM tenants WHERE id = ?", [config.defaultTenantId]);
  if (!tenant) {
    await db.run(
      "INSERT INTO tenants (id, name, status, created_at) VALUES (?, ?, 'active', ?)",
      [config.defaultTenantId, `Default (${config.defaultTenantId})`, new Date().toISOString()]
    );
  }
}

await ensureDefaultTenant();

const STREAM_STATUS_NAMES = ["NONE", "PENDING", "ACTIVE", "PAUSED", "COMPLETED", "CANCELED", "EXPIRED"];
const TRIGGER_POLICY_NAMES = [
  "NONE",
  "SENDER_ONLY",
  "RECEIVER_ONLY",
  "EITHER_PARTY",
  "BOTH_PARTIES",
  "AUTHORIZED_OPERATOR",
];
const COMMERCIAL_STATE_SIGNATURE =
  "getStreamCommercialState(uint256)(uint8,uint8,uint256,uint256,uint256,address,bytes32,bool,bool)";

function json(res, status, payload, requestId) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Idempotency-Key,X-API-Key,X-Request-Id",
  };
  if (requestId) headers["X-Request-Id"] = requestId;
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function text(res, status, payload, requestId) {
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Idempotency-Key,X-API-Key,X-Request-Id",
  };
  if (requestId) headers["X-Request-Id"] = requestId;
  res.writeHead(status, headers);
  res.end(payload);
}

function error(res, status, code, message, requestId) {
  json(res, status, { code, message, ...(requestId ? { requestId } : {}) }, requestId);
}

function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isBytes32(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function mustAddress(value, key) {
  const address = mustString(value, key);
  if (!isAddress(address)) {
    throw new Error(`invalid ${key}`);
  }
  return address;
}

async function readBody(req, limitBytes = config.requestBodyLimitBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      throw new Error("BODY_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  return JSON.parse(raw);
}

function mustString(value, key) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`missing/invalid ${key}`);
  }
  return value;
}

function mustUint(value, key) {
  const raw = value ?? "";
  const text = typeof raw === "number" ? String(Math.trunc(raw)) : String(raw);
  if (!/^\d+$/.test(text)) {
    throw new Error(`${key} must be unsigned integer`);
  }
  return BigInt(text);
}

function toMaybeNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseOptionalStatus(value) {
  if (value === undefined || value === null || value === "") return "active";
  const text = String(value).trim().toLowerCase();
  if (text === "active" || text === "inactive") return text;
  throw new Error("invalid status");
}

function parseTriggerMode(value) {
  if (value === undefined || value === null || value === "") return "on_request";
  const text = String(value).trim().toLowerCase();
  if (text !== "on_request") {
    throw new Error("invalid triggerMode");
  }
  return text;
}

function parseTriggerPolicyName(value, key = "expectedTriggerPolicy") {
  if (value === undefined || value === null || value === "") return "";

  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const idx = Number(value);
    if (!Number.isInteger(idx) || idx < 0 || idx >= TRIGGER_POLICY_NAMES.length) {
      throw new Error(`invalid ${key}`);
    }
    return TRIGGER_POLICY_NAMES[idx];
  }

  const text = String(value).trim().toUpperCase();
  if (!TRIGGER_POLICY_NAMES.includes(text)) {
    throw new Error(`invalid ${key}`);
  }
  return text;
}

function normalizeServiceRef(value) {
  if (value === undefined || value === null || value === "") return "";
  if (isBytes32(value)) return value;
  return hashHex(String(value));
}

function normalizeMetadata(value, key = "metadata") {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") {
    throw new Error(`invalid ${key}`);
  }
  return value;
}

function statusName(code) {
  return STREAM_STATUS_NAMES[Number(code)] ?? "UNKNOWN";
}

function triggerPolicyName(code) {
  return TRIGGER_POLICY_NAMES[Number(code)] ?? "UNKNOWN";
}

function hashHex(input) {
  return `0x${createHash("sha256").update(input).digest("hex")}`;
}

function toWindow(ts, windowSeconds) {
  const sec = BigInt(windowSeconds);
  const t = BigInt(ts);
  const start = (t / sec) * sec;
  const end = start + sec;
  return { windowStart: Number(start), windowEnd: Number(end) };
}

function normalizeUsageEvent(raw, windowSeconds) {
  if (!raw || typeof raw !== "object") {
    throw new Error("invalid usage event");
  }

  const requestId = raw.requestId ?? raw.request_id ?? "";
  const payer = mustString(raw.payer, "payer");
  const provider = mustString(raw.provider, "provider");
  const token = mustString(raw.token, "token");

  const usageUnits = mustUint(raw.usageUnits ?? raw.usage_units, "usageUnits");
  const unitPriceWei = mustUint(raw.unitPriceWei ?? raw.unit_price_wei, "unitPriceWei");
  const requestTs = mustUint(raw.requestTs ?? raw.request_ts, "requestTs");
  const amountWei = raw.amountWei ? mustUint(raw.amountWei, "amountWei") : usageUnits * unitPriceWei;

  const eventId =
    raw.eventId ??
    (requestId
      ? hashHex(
          `${requestId}|${payer.toLowerCase()}|${provider.toLowerCase()}|${token.toLowerCase()}|${requestTs.toString()}|${usageUnits.toString()}|${unitPriceWei.toString()}`
        )
      : "");

  if (!eventId) {
    throw new Error("eventId or requestId required");
  }

  const windowStart =
    typeof raw.windowStart === "number" ? raw.windowStart : toWindow(requestTs, windowSeconds).windowStart;
  const windowEnd =
    typeof raw.windowEnd === "number" ? raw.windowEnd : toWindow(requestTs, windowSeconds).windowEnd;

  return {
    type: "usage_event",
    version: 1,
    eventId,
    requestId,
    payer,
    provider,
    token,
    usageUnits: usageUnits.toString(),
    unitPriceWei: unitPriceWei.toString(),
    amountWei: amountWei.toString(),
    requestTs: requestTs.toString(),
    windowStart,
    windowEnd,
  };
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function requestHash(payload) {
  return createHash("sha256").update(stableStringify(payload ?? null)).digest("hex");
}

async function beginIdempotency(tenantId, endpoint, key, payloadHash) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.idempotencyTtlSeconds * 1000).toISOString();
  const nowIso = now.toISOString();

  return db.transaction(async (tx) => {
    await tx.run("DELETE FROM idempotency_keys WHERE expires_at <= ?", [nowIso]);

    const insert = await tx.run(
      "INSERT INTO idempotency_keys (tenant_id, endpoint, idem_key, request_hash, status, created_at, expires_at) VALUES (?, ?, ?, ?, 'processing', ?, ?) ON CONFLICT(tenant_id, endpoint, idem_key) DO NOTHING",
      [tenantId, endpoint, key, payloadHash, nowIso, expiresAt]
    );
    const changes = insert?.changes ?? insert?.rowCount ?? 0;
    if (changes > 0) {
      return { status: "new" };
    }

    const existing = await tx.get(
      "SELECT request_hash, status, response_status, response_body, expires_at FROM idempotency_keys WHERE tenant_id = ? AND endpoint = ? AND idem_key = ?",
      [tenantId, endpoint, key]
    );

    if (!existing) {
      return { status: "new" };
    }

    if (existing.request_hash !== payloadHash) {
      return { status: "conflict" };
    }

    if (existing.status === "completed" && existing.response_body) {
      return {
        status: "replay",
        responseStatus: existing.response_status ?? 200,
        responseBody: JSON.parse(existing.response_body),
      };
    }

    return { status: "processing" };
  });
}

async function completeIdempotency(tenantId, endpoint, key, status, responseBody) {
  await db.run(
    "UPDATE idempotency_keys SET status = 'completed', response_status = ?, response_body = ? WHERE tenant_id = ? AND endpoint = ? AND idem_key = ?",
    [status, JSON.stringify(responseBody ?? null), tenantId, endpoint, key]
  );
}

function getIdempotencyKey(req, body) {
  const header = req.headers["idempotency-key"] ?? req.headers["Idempotency-Key"]; // node lowercases
  if (typeof header === "string" && header.trim()) return header.trim();
  if (body && typeof body === "object" && body.idempotencyKey) return String(body.idempotencyKey);
  return "";
}

async function insertUsageEvents(tenantId, events) {
  const now = new Date().toISOString();
  let inserted = 0;
  await db.transaction(async (tx) => {
    for (const event of events) {
      const result = await tx.run(
        "INSERT INTO usage_events (tenant_id, event_id, request_id, payer, provider, token, usage_units, unit_price_wei, amount_wei, request_ts, window_start, window_end, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, event_id) DO NOTHING",
        [
          tenantId,
          event.eventId,
          event.requestId || null,
          event.payer,
          event.provider,
          event.token,
          event.usageUnits,
          event.unitPriceWei,
          event.amountWei,
          event.requestTs,
          event.windowStart,
          event.windowEnd,
          now,
        ]
      );
      const changes = result?.changes ?? result?.rowCount ?? 0;
      inserted += changes;
    }
  });
  return inserted;
}

async function loadUsageEvents(tenantId, { from, to, limit } = {}) {
  const clauses = ["tenant_id = ?"];
  const params = [tenantId];
  if (from) {
    clauses.push("request_ts >= ?");
    params.push(Number(from));
  }
  if (to) {
    clauses.push("request_ts <= ?");
    params.push(Number(to));
  }
  let sql = `SELECT event_id, request_id, payer, provider, token, usage_units, unit_price_wei, amount_wei, request_ts, window_start, window_end FROM usage_events WHERE ${clauses.join(
    " AND "
  )} ORDER BY request_ts ASC`;
  if (limit) {
    sql += " LIMIT ?";
    params.push(Number(limit));
  }

  const rows = await db.all(sql, params);
  return rows.map((row) => ({
    eventId: row.event_id,
    requestId: row.request_id ?? "",
    payer: row.payer,
    provider: row.provider,
    token: row.token,
    usageUnits: row.usage_units,
    unitPriceWei: row.unit_price_wei,
    amountWei: row.amount_wei,
    requestTs: row.request_ts,
    windowStart: Number(row.window_start),
    windowEnd: Number(row.window_end),
  }));
}

async function enqueueRetryWindow(tenantId, window, errorMessage) {
  const now = new Date().toISOString();
  await db.run(
    "INSERT INTO settlement_retry_queue (tenant_id, window_id, payload_json, attempts, last_error, updated_at, created_at) VALUES (?, ?, ?, 1, ?, ?, ?) ON CONFLICT(tenant_id, window_id) DO UPDATE SET attempts = settlement_retry_queue.attempts + 1, last_error = excluded.last_error, updated_at = excluded.updated_at",
    [tenantId, window.windowId, JSON.stringify(window), errorMessage ?? null, now, now]
  );
}

async function loadRetryQueue(tenantId) {
  const rows = await db.all(
    "SELECT window_id, payload_json, attempts, last_error FROM settlement_retry_queue WHERE tenant_id = ? ORDER BY updated_at ASC",
    [tenantId]
  );
  return rows.map((row) => ({
    windowId: row.window_id,
    window: JSON.parse(row.payload_json),
    attempts: row.attempts,
    lastError: row.last_error,
  }));
}

async function clearRetryWindow(tenantId, windowId) {
  await db.run("DELETE FROM settlement_retry_queue WHERE tenant_id = ? AND window_id = ?", [tenantId, windowId]);
}

async function recordSubmission(tenantId, windowId, status, txHash, errorMessage) {
  await db.run(
    "INSERT INTO settlement_submissions (tenant_id, window_id, tx_hash, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [tenantId, windowId, txHash ?? null, status, errorMessage ?? null, new Date().toISOString()]
  );
}

function mapServiceTriggerRow(row) {
  if (!row) return null;
  return {
    serviceId: row.service_id,
    streamId: row.stream_id,
    provider: row.provider,
    triggerMode: row.trigger_mode,
    expectedTriggerPolicy: row.expected_trigger_policy ?? "",
    expectedServiceRef: row.expected_service_ref ?? "",
    status: row.status,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    lastRequestId: row.last_request_id ?? "",
    lastTriggerResult: row.last_trigger_result ?? "",
    lastTriggeredAt: row.last_triggered_at ?? null,
    lastTxHash: row.last_tx_hash ?? "",
    lastError: row.last_error ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeMetadata(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

async function loadServiceTrigger(tenantId, serviceId) {
  const row = await db.get(
    `SELECT service_id, stream_id, provider, trigger_mode, expected_trigger_policy, expected_service_ref, status,
            metadata_json, last_request_id, last_trigger_result, last_triggered_at, last_tx_hash, last_error,
            created_at, updated_at
       FROM service_triggers
      WHERE tenant_id = ? AND service_id = ?`,
    [tenantId, serviceId]
  );
  return mapServiceTriggerRow(row);
}

async function upsertServiceTrigger(tenantId, serviceId, input) {
  const now = new Date().toISOString();
  const existing = await loadServiceTrigger(tenantId, serviceId);
  const createdAt = existing?.createdAt ?? now;

  await db.run(
    `INSERT INTO service_triggers (
        tenant_id, service_id, stream_id, provider, trigger_mode, expected_trigger_policy, expected_service_ref,
        status, metadata_json, last_request_id, last_trigger_result, last_triggered_at, last_tx_hash, last_error,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, service_id) DO UPDATE SET
        stream_id = excluded.stream_id,
        provider = excluded.provider,
        trigger_mode = excluded.trigger_mode,
        expected_trigger_policy = excluded.expected_trigger_policy,
        expected_service_ref = excluded.expected_service_ref,
        status = excluded.status,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at`,
    [
      tenantId,
      serviceId,
      input.streamId,
      input.provider,
      input.triggerMode,
      input.expectedTriggerPolicy || null,
      input.expectedServiceRef || null,
      input.status,
      serializeMetadata(input.metadata),
      existing?.lastRequestId || null,
      existing?.lastTriggerResult || null,
      existing?.lastTriggeredAt || null,
      existing?.lastTxHash || null,
      existing?.lastError || null,
      createdAt,
      now,
    ]
  );

  return loadServiceTrigger(tenantId, serviceId);
}

async function updateServiceTriggerResult(tenantId, serviceId, result) {
  const now = new Date().toISOString();
  await db.run(
    `UPDATE service_triggers
        SET last_request_id = ?,
            last_trigger_result = ?,
            last_triggered_at = ?,
            last_tx_hash = ?,
            last_error = ?,
            updated_at = ?
      WHERE tenant_id = ? AND service_id = ?`,
    [
      result.requestId,
      result.outcome,
      now,
      result.txHash || null,
      result.error || null,
      now,
      tenantId,
      serviceId,
    ]
  );
}

async function recordServiceTriggerEvent(tenantId, serviceId, event) {
  await db.run(
    `INSERT INTO service_trigger_events (
        tenant_id, service_id, request_id, stream_id, outcome, tx_hash, error, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, service_id, request_id) DO UPDATE SET
        stream_id = excluded.stream_id,
        outcome = excluded.outcome,
        tx_hash = excluded.tx_hash,
        error = excluded.error,
        metadata_json = excluded.metadata_json`,
    [
      tenantId,
      serviceId,
      event.requestId,
      event.streamId,
      event.outcome,
      event.txHash || null,
      event.error || null,
      serializeMetadata(event.metadata),
      new Date().toISOString(),
    ]
  );
}

async function checkRateLimit(scope, limitPerMin) {
  if (!limitPerMin || limitPerMin <= 0) return { allowed: true };
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSec / 60) * 60;

  const count = await db.transaction(async (tx) => {
    await tx.run(
      "INSERT INTO rate_limits (scope, window_start, count) VALUES (?, ?, 1) ON CONFLICT(scope, window_start) DO UPDATE SET count = rate_limits.count + 1",
      [scope, windowStart]
    );
    const row = await tx.get("SELECT count FROM rate_limits WHERE scope = ? AND window_start = ?", [scope, windowStart]);
    return row?.count ?? 0;
  });

  return { allowed: count <= limitPerMin, remaining: Math.max(0, limitPerMin - count) };
}

async function checkCircuitBreaker(tenantId) {
  const row = await db.get("SELECT blocked_until, reason FROM tenant_circuit WHERE tenant_id = ?", [tenantId]);
  if (!row || !row.blocked_until) return { blocked: false };
  const now = Math.floor(Date.now() / 1000);
  if (now < Number(row.blocked_until)) {
    return { blocked: true, reason: row.reason, retryAfter: Number(row.blocked_until) - now };
  }
  return { blocked: false };
}

async function recordError(tenantId, reason) {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSec / config.circuitWindowSeconds) * config.circuitWindowSeconds;

  const count = await db.transaction(async (tx) => {
    await tx.run(
      "INSERT INTO tenant_errors (tenant_id, window_start, count) VALUES (?, ?, 1) ON CONFLICT(tenant_id, window_start) DO UPDATE SET count = tenant_errors.count + 1",
      [tenantId, windowStart]
    );
    const row = await tx.get("SELECT count FROM tenant_errors WHERE tenant_id = ? AND window_start = ?", [tenantId, windowStart]);
    return row?.count ?? 0;
  });

  if (count >= config.circuitErrorThreshold) {
    const blockedUntil = nowSec + config.circuitCooldownSeconds;
    await db.run(
      "INSERT INTO tenant_circuit (tenant_id, blocked_until, reason, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET blocked_until = excluded.blocked_until, reason = excluded.reason, updated_at = excluded.updated_at",
      [tenantId, blockedUntil, reason ?? "error_threshold", new Date().toISOString()]
    );
  }
}

async function recordRisk(tenantId, kind, detail) {
  await db.run(
    "INSERT INTO risk_events (tenant_id, kind, detail_json, created_at) VALUES (?, ?, ?, ?)",
    [tenantId, kind, JSON.stringify(detail ?? null), new Date().toISOString()]
  );
}

async function triggerCircuit(tenantId, reason) {
  const nowSec = Math.floor(Date.now() / 1000);
  const blockedUntil = nowSec + config.circuitCooldownSeconds;
  await db.run(
    "INSERT INTO tenant_circuit (tenant_id, blocked_until, reason, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET blocked_until = excluded.blocked_until, reason = excluded.reason, updated_at = excluded.updated_at",
    [tenantId, blockedUntil, reason, new Date().toISOString()]
  );
}

function shouldEnforceAllowlist(kind) {
  if (config.allowlistEnforce) return true;
  return config.allowlistKinds.includes(kind);
}

async function checkAllowlist(tenantId, kind, value) {
  if (!shouldEnforceAllowlist(kind)) return true;
  const row = await db.get(
    "SELECT status FROM allowlist WHERE tenant_id = ? AND kind = ? AND value = ?",
    [tenantId, kind, String(value).toLowerCase()]
  );
  return row && row.status === "active";
}

function enforceUsageThresholds(events) {
  if (events.length > config.maxEventsPerRequest) {
    return { ok: false, reason: "MAX_EVENTS_PER_REQUEST" };
  }
  let totalAmount = 0n;
  for (const event of events) {
    const amount = BigInt(event.amountWei);
    totalAmount += amount;
    if (config.maxEventAmountWei && BigInt(config.maxEventAmountWei) > 0n && amount > BigInt(config.maxEventAmountWei)) {
      return { ok: false, reason: "MAX_EVENT_AMOUNT" };
    }
  }
  if (config.maxTotalAmountWei && BigInt(config.maxTotalAmountWei) > 0n && totalAmount > BigInt(config.maxTotalAmountWei)) {
    return { ok: false, reason: "MAX_TOTAL_AMOUNT" };
  }
  return { ok: true };
}

function hashToBytes32(input) {
  return `0x${createHash("sha256").update(input).digest("hex")}`;
}

function runCast(args) {
  const res = spawnSync(config.castBin, args, { encoding: "utf8" });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || `${config.castBin} failed`).trim();
    throw new Error(err);
  }
  return (res.stdout || "").trim();
}

function normalizeRpcResult(output) {
  const trimmed = String(output ?? "").trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object" && typeof parsed.result === "string") {
      return parsed.result;
    }
  } catch {
    // ignore
  }

  return trimmed;
}

let cachedTriggerOperatorAddress;

function getTriggerOperatorAddress() {
  if (config.streamTriggerOperatorAddress) {
    return config.streamTriggerOperatorAddress;
  }

  if (cachedTriggerOperatorAddress !== undefined) {
    return cachedTriggerOperatorAddress;
  }

  if (!config.streamTriggerPrivateKey) {
    cachedTriggerOperatorAddress = "";
    return cachedTriggerOperatorAddress;
  }

  cachedTriggerOperatorAddress = runCast(["wallet", "address", "--private-key", config.streamTriggerPrivateKey]);
  return cachedTriggerOperatorAddress;
}

function getOperatorContext() {
  let address = "";
  try {
    address = getTriggerOperatorAddress();
  } catch {
    address = config.streamTriggerOperatorAddress || "";
  }
  return {
    enabled: Boolean(config.rpcUrl && config.polkaStream && config.streamTriggerPrivateKey),
    address: address || null,
  };
}

function mapCommercialState(streamId, decoded) {
  const [statusCode, triggerPolicyCode, createdAt, activatedAt, activationDeadline, authorizedActivator, serviceRef, senderConfirmed, receiverConfirmed] =
    decoded;

  const status = statusName(statusCode);
  const triggerPolicy = triggerPolicyName(triggerPolicyCode);

  return {
    streamId: String(streamId),
    status,
    statusCode: Number(statusCode),
    triggerPolicy,
    triggerPolicyCode: Number(triggerPolicyCode),
    createdAt: toMaybeNumber(createdAt),
    activatedAt: toMaybeNumber(activatedAt),
    activationDeadline: toMaybeNumber(activationDeadline),
    authorizedActivator,
    serviceRef,
    senderConfirmed: Boolean(senderConfirmed),
    receiverConfirmed: Boolean(receiverConfirmed),
    billingStarted:
      status !== "PENDING" && status !== "NONE" && status !== "EXPIRED" && toMaybeNumber(activatedAt) > 0,
  };
}

function readStreamCommercialState(streamId) {
  if (!config.rpcUrl || !config.polkaStream) {
    throw new Error("RPC_URL / NEXT_PUBLIC_POLKASTREAM_ADDRESS required");
  }

  const calldata = runCast(["calldata", COMMERCIAL_STATE_SIGNATURE, String(streamId)]);
  const raw = runCast([
    "rpc",
    "eth_call",
    JSON.stringify([{ to: config.polkaStream, data: calldata }, "latest"]),
    "--raw",
    "--rpc-url",
    config.rpcUrl,
  ]);
  const result = normalizeRpcResult(raw);
  const decoded = JSON.parse(runCast(["decode-abi", "--json", COMMERCIAL_STATE_SIGNATURE, result]));
  return mapCommercialState(streamId, decoded);
}

function safeReadStreamCommercialState(streamId) {
  try {
    return readStreamCommercialState(streamId);
  } catch {
    return null;
  }
}

function submitActivateStream(streamId) {
  if (!config.rpcUrl || !config.polkaStream || !config.streamTriggerPrivateKey) {
    return {
      ok: false,
      error: "RPC_URL / NEXT_PUBLIC_POLKASTREAM_ADDRESS / STREAM_TRIGGER_PRIVATE_KEY required",
    };
  }

  const res = spawnSync(
    config.castBin,
    [
      "send",
      config.polkaStream,
      "activateStream(uint256)",
      String(streamId),
      "--private-key",
      config.streamTriggerPrivateKey,
      "--rpc-url",
      config.rpcUrl,
      "--json",
    ],
    { encoding: "utf8" }
  );

  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || "cast send failed").trim();
    return { ok: false, error: err };
  }

  let txHash = "";
  try {
    const parsed = JSON.parse(res.stdout || "{}");
    txHash = parsed.transactionHash ?? parsed.hash ?? "";
  } catch {
    txHash = "";
  }

  return { ok: true, txHash };
}

function evaluateOperatorEligibility(commercialState) {
  const operator = getOperatorContext();

  if (!operator.enabled) {
    return {
      ...operator,
      eligible: false,
      reason: "STREAM_TRIGGER_PRIVATE_KEY not configured",
    };
  }

  if (commercialState.triggerPolicy === "AUTHORIZED_OPERATOR") {
    if (!operator.address) {
      return { ...operator, eligible: false, reason: "operator address unavailable" };
    }

    if (commercialState.authorizedActivator.toLowerCase() !== operator.address.toLowerCase()) {
      return {
        ...operator,
        eligible: false,
        reason: "operator address does not match authorizedActivator",
      };
    }
  }

  return { ...operator, eligible: true, reason: "ok" };
}

function validateServiceTriggerAgainstState(service, commercialState) {
  if (service.expectedTriggerPolicy && service.expectedTriggerPolicy !== commercialState.triggerPolicy) {
    return `expected trigger policy ${service.expectedTriggerPolicy}, got ${commercialState.triggerPolicy}`;
  }

  if (
    service.expectedServiceRef &&
    service.expectedServiceRef.toLowerCase() !== String(commercialState.serviceRef || "").toLowerCase()
  ) {
    return "expected serviceRef does not match onchain stream";
  }

  return "";
}

function aggregateWindows(events, windowSeconds) {
  const normalizedEvents = [...events].sort((a, b) => Number(BigInt(a.requestTs) - BigInt(b.requestTs)));
  const windows = new Map();

  for (const event of normalizedEvents) {
    const windowStart = Math.floor(Number(event.requestTs) / windowSeconds) * windowSeconds;
    const windowEnd = windowStart + windowSeconds;
    const key = String(windowStart);

    if (!windows.has(key)) {
      windows.set(key, { windowStart, windowEnd, events: [], byParty: new Map() });
    }

    const window = windows.get(key);
    window.events.push(event);

    const itemKey = [event.payer, event.provider, event.token].map((v) => String(v).toLowerCase()).join("|");
    if (!window.byParty.has(itemKey)) {
      window.byParty.set(itemKey, {
        payer: event.payer,
        provider: event.provider,
        token: event.token,
        amountWei: 0n,
        requestCount: 0,
      });
    }

    const item = window.byParty.get(itemKey);
    item.amountWei += BigInt(event.amountWei);
    item.requestCount += 1;
  }

  const result = [];
  for (const [, window] of [...windows.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const items = [...window.byParty.values()].sort((a, b) => {
      const ka = `${a.payer}|${a.provider}|${a.token}`.toLowerCase();
      const kb = `${b.payer}|${b.provider}|${b.token}`.toLowerCase();
      return ka.localeCompare(kb);
    });

    const totalAmountWei = items.reduce((acc, item) => acc + item.amountWei, 0n);
    const totalRequests = items.reduce((acc, item) => acc + item.requestCount, 0);
    const payloadKey = [
      window.windowStart,
      window.windowEnd,
      items
        .map(
          (item) =>
            `${item.payer.toLowerCase()},${item.provider.toLowerCase()},${item.token.toLowerCase()},${item.amountWei.toString()},${item.requestCount}`
        )
        .join(";"),
    ].join("|");

    result.push({
      windowId: hashToBytes32(payloadKey),
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      requestEvents: window.events.length,
      totalAmountWei,
      totalRequests,
      items,
    });
  }

  return result;
}

function computeMetrics(events, windows) {
  const requestLevelTxCount = events.length;
  const batchedTxCount = windows.length;
  const txReductionPct =
    requestLevelTxCount === 0
      ? 0
      : ((requestLevelTxCount - batchedTxCount) * 100) / requestLevelTxCount;

  let totalLatency = 0;
  for (const event of events) {
    totalLatency += Math.max(0, Number(event.windowEnd) - Number(event.requestTs));
  }
  const avgLatencySeconds = events.length === 0 ? 0 : totalLatency / events.length;

  return {
    requestEvents: requestLevelTxCount,
    batchedWindows: batchedTxCount,
    txReductionPct: Number(txReductionPct.toFixed(2)),
    avgAggregationLatencySeconds: Number(avgLatencySeconds.toFixed(2)),
    throughputRequestsPerBatchTx: batchedTxCount === 0 ? 0 : Number((requestLevelTxCount / batchedTxCount).toFixed(2)),
  };
}

function toTupleArray(items) {
  return `[${items
    .map(
      (item) =>
        `(${item.payer},${item.provider},${item.token},${item.amountWei.toString()},${item.requestCount})`
    )
    .join(",")}]`;
}

function castCall(address, signature, args, rpcUrl) {
  const cmd = ["call", address, signature, ...(args ?? []), "--rpc-url", rpcUrl];
  const res = spawnSync(config.castBin, cmd, { encoding: "utf8" });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || "cast call failed").trim();
    throw new Error(err);
  }
  return (res.stdout || "").trim();
}

function submitWindow(window, rpcUrl, hubAddress, privateKey) {
  const cmd = [
    "send",
    hubAddress,
    "settleWindow(bytes32,(address,address,address,uint256,uint32)[])",
    window.windowId,
    toTupleArray(window.items),
    "--private-key",
    privateKey,
    "--rpc-url",
    rpcUrl,
    "--json",
  ];

  const res = spawnSync(config.castBin, cmd, { encoding: "utf8" });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || "cast send failed").trim();
    return { ok: false, error: err };
  }

  let txHash = "";
  try {
    const parsed = JSON.parse(res.stdout || "{}");
    txHash = parsed.transactionHash ?? parsed.hash ?? "";
  } catch {
    txHash = "";
  }

  return { ok: true, txHash };
}

function toCsvReport(windows) {
  const rows = ["window_start,window_end,payer,provider,token,amount_wei,request_count"];
  for (const window of windows) {
    for (const item of window.items) {
      rows.push(
        [
          window.windowStart,
          window.windowEnd,
          item.payer,
          item.provider,
          item.token,
          item.amountWei.toString(),
          item.requestCount,
        ].join(",")
      );
    }
  }
  return rows.join("\n");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,Idempotency-Key,X-API-Key,X-Request-Id",
    });
    res.end();
    return;
  }

  if (!req.url) {
    error(res, 400, "INVALID_REQUEST", "Missing request url");
    return;
  }

  const requestId = randomUUID();
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname, searchParams } = url;

  let authContext = null;

  try {
    if (pathname === "/v1/health" && req.method === "GET") {
      json(res, 200, { status: "ok", timeUtc: new Date().toISOString(), config: toSafeConfig(config) }, requestId);
      return;
    }

    if (pathname === "/v1/config" && req.method === "GET") {
      json(res, 200, toSafeConfig(config), requestId);
      return;
    }

    authContext = await authenticateRequest(req, config, db);

    const circuit = await checkCircuitBreaker(authContext.tenantId);
    if (circuit.blocked) {
      error(res, 429, "TENANT_BLOCKED", circuit.reason ?? "tenant blocked", requestId);
      return;
    }

    const globalLimit = await checkRateLimit("global", config.rateLimitGlobalPerMin);
    if (!globalLimit.allowed) {
      error(res, 429, "RATE_LIMIT", "global rate limit exceeded", requestId);
      return;
    }

    const tenantLimit = await checkRateLimit(`tenant:${authContext.tenantId}`, config.rateLimitTenantPerMin);
    if (!tenantLimit.allowed) {
      error(res, 429, "RATE_LIMIT", "tenant rate limit exceeded", requestId);
      return;
    }

    const commercialStateMatch = pathname.match(/^\/v1\/streams\/([^/]+)\/commercial-state$/);
    if (commercialStateMatch && req.method === "GET") {
      if (!hasScope(authContext.scopes, "service.read")) {
        error(res, 403, "FORBIDDEN", "missing scope service.read", requestId);
        return;
      }

      if (!config.rpcUrl || !config.polkaStream) {
        error(res, 500, "MISSING_ENV", "RPC_URL / NEXT_PUBLIC_POLKASTREAM_ADDRESS required", requestId);
        return;
      }

      const streamId = mustUint(decodeURIComponent(commercialStateMatch[1]), "streamId");
      const commercialState = readStreamCommercialState(streamId.toString());
      const operator = evaluateOperatorEligibility(commercialState);

      json(
        res,
        200,
        {
          streamId: String(streamId),
          contract: config.polkaStream,
          commercialState,
          operator,
        },
        requestId
      );
      return;
    }

    const serviceMatch = pathname.match(/^\/v1\/services\/([^/]+)$/);
    if (serviceMatch && req.method === "GET") {
      if (!hasScope(authContext.scopes, "service.read")) {
        error(res, 403, "FORBIDDEN", "missing scope service.read", requestId);
        return;
      }

      const serviceId = decodeURIComponent(serviceMatch[1]);
      const service = await loadServiceTrigger(authContext.tenantId, serviceId);
      if (!service) {
        error(res, 404, "NOT_FOUND", "service trigger not found", requestId);
        return;
      }

      const commercialState =
        config.rpcUrl && config.polkaStream ? safeReadStreamCommercialState(service.streamId) : null;
      const operator = commercialState ? evaluateOperatorEligibility(commercialState) : getOperatorContext();

      json(res, 200, { service, commercialState, operator }, requestId);
      return;
    }

    if (serviceMatch && req.method === "PUT") {
      if (!hasScope(authContext.scopes, "service.write")) {
        error(res, 403, "FORBIDDEN", "missing scope service.write", requestId);
        return;
      }

      const body = (await readBody(req)) ?? {};
      const serviceId = decodeURIComponent(serviceMatch[1]);
      if (body.serviceId && String(body.serviceId) !== serviceId) {
        error(res, 400, "INVALID_REQUEST", "serviceId in path/body mismatch", requestId);
        return;
      }

      const payload = {
        streamId: mustUint(body.streamId, "streamId").toString(),
        provider: mustAddress(body.provider, "provider"),
        triggerMode: parseTriggerMode(body.triggerMode),
        expectedTriggerPolicy: parseTriggerPolicyName(body.expectedTriggerPolicy),
        expectedServiceRef: normalizeServiceRef(body.expectedServiceRef ?? body.serviceRef),
        status: parseOptionalStatus(body.status),
        metadata: normalizeMetadata(body.metadata),
      };

      const service = await upsertServiceTrigger(authContext.tenantId, serviceId, payload);
      const commercialState =
        config.rpcUrl && config.polkaStream ? safeReadStreamCommercialState(service.streamId) : null;
      const operator = commercialState ? evaluateOperatorEligibility(commercialState) : getOperatorContext();

      json(res, 200, { service, commercialState, operator }, requestId);
      return;
    }

    const serviceTriggerMatch = pathname.match(/^\/v1\/services\/([^/]+)\/trigger$/);
    if (serviceTriggerMatch && req.method === "POST") {
      if (!hasScope(authContext.scopes, "service.trigger")) {
        error(res, 403, "FORBIDDEN", "missing scope service.trigger", requestId);
        return;
      }

      const body = (await readBody(req)) ?? {};
      const serviceId = decodeURIComponent(serviceTriggerMatch[1]);
      const service = await loadServiceTrigger(authContext.tenantId, serviceId);
      if (!service) {
        error(res, 404, "NOT_FOUND", "service trigger not found", requestId);
        return;
      }
      if (service.status !== "active") {
        error(res, 409, "SERVICE_DISABLED", "service trigger is inactive", requestId);
        return;
      }

      const invocationId = mustString(body.requestId ?? body.invocationId ?? getIdempotencyKey(req, body), "requestId");
      const incomingStreamId =
        body.streamId !== undefined && body.streamId !== null && body.streamId !== ""
          ? mustUint(body.streamId, "streamId").toString()
          : service.streamId;
      if (incomingStreamId !== service.streamId) {
        error(res, 409, "STREAM_MISMATCH", "streamId does not match registered service", requestId);
        return;
      }

      const idem = await beginIdempotency(authContext.tenantId, pathname, invocationId, requestHash(body));
      if (idem.status === "conflict") {
        error(res, 409, "IDEMPOTENCY_CONFLICT", "idempotency key conflict", requestId);
        return;
      }
      if (idem.status === "replay") {
        json(res, idem.responseStatus, idem.responseBody, requestId);
        return;
      }
      if (idem.status === "processing") {
        error(res, 409, "IDEMPOTENCY_IN_PROGRESS", "idempotency key is processing", requestId);
        return;
      }

      try {
        if (!config.rpcUrl || !config.polkaStream) {
          const response = {
            serviceId,
            requestId: invocationId,
            streamId: service.streamId,
            result: "activation_failed",
            activationTxHash: null,
            commercialState: null,
            operator: getOperatorContext(),
            metadata: null,
            error: "RPC_URL / NEXT_PUBLIC_POLKASTREAM_ADDRESS required",
          };
          await completeIdempotency(authContext.tenantId, pathname, invocationId, 500, response);
          json(res, 500, response, requestId);
          return;
        }

        const commercialState = readStreamCommercialState(service.streamId);
        const mismatch = validateServiceTriggerAgainstState(service, commercialState);
        if (mismatch) {
          const response = {
            serviceId,
            requestId: invocationId,
            streamId: service.streamId,
            result: "service_config_mismatch",
            activationTxHash: null,
            commercialState,
            operator: evaluateOperatorEligibility(commercialState),
            metadata: null,
            error: mismatch,
          };
          await completeIdempotency(authContext.tenantId, pathname, invocationId, 409, response);
          json(res, 409, response, requestId);
          return;
        }

        const operator = evaluateOperatorEligibility(commercialState);
        const metadata = normalizeMetadata(body.metadata, "metadata");
        const dryRun = Boolean(body.dryRun);

        let outcome = "noop";
        let txHash = "";
        let errorMessage = "";
        let nextState = commercialState;
        let httpStatus = 200;

        if (commercialState.status === "PENDING") {
          if (!operator.eligible) {
            httpStatus = 409;
            outcome = "activation_blocked";
            errorMessage = operator.reason;
          } else if (dryRun) {
            outcome = "pending_ready";
          } else {
            const activation = submitActivateStream(service.streamId);
            if (!activation.ok) {
              const refreshedState = safeReadStreamCommercialState(service.streamId);
              if (refreshedState && refreshedState.status !== "PENDING") {
                outcome = refreshedState.billingStarted ? "already_active" : "not_pending";
                nextState = refreshedState;
              } else {
                httpStatus = 502;
                outcome = "activation_failed";
                errorMessage = activation.error;
              }
            } else {
              txHash = activation.txHash;
              outcome = "activated";
              nextState = safeReadStreamCommercialState(service.streamId) ?? commercialState;
            }
          }
        } else if (commercialState.status === "ACTIVE" || commercialState.status === "PAUSED") {
          outcome = "already_active";
        } else if (
          commercialState.status === "COMPLETED" ||
          commercialState.status === "CANCELED" ||
          commercialState.status === "EXPIRED"
        ) {
          httpStatus = 409;
          outcome = "stream_closed";
          errorMessage = `stream is ${commercialState.status.toLowerCase()}`;
        } else {
          httpStatus = 409;
          outcome = "invalid_stream_state";
          errorMessage = `stream status ${commercialState.status} is not triggerable`;
        }

        const response = {
          serviceId,
          requestId: invocationId,
          streamId: service.streamId,
          result: outcome,
          activationTxHash: txHash || null,
          commercialState: nextState,
          operator,
          metadata,
          error: errorMessage || null,
        };

        await updateServiceTriggerResult(authContext.tenantId, serviceId, {
          requestId: invocationId,
          outcome,
          txHash,
          error: errorMessage,
        });
        await recordServiceTriggerEvent(authContext.tenantId, serviceId, {
          requestId: invocationId,
          streamId: service.streamId,
          outcome,
          txHash,
          error: errorMessage,
          metadata,
        });
        await completeIdempotency(authContext.tenantId, pathname, invocationId, httpStatus, response);

        json(res, httpStatus, response, requestId);
      } catch (triggerError) {
        const response = {
          serviceId,
          requestId: invocationId,
          streamId: service.streamId,
          result: "activation_failed",
          activationTxHash: null,
          commercialState: null,
          operator: getOperatorContext(),
          metadata: null,
          error: triggerError?.message ?? "service trigger failed",
        };
        await completeIdempotency(authContext.tenantId, pathname, invocationId, 500, response);
        json(res, 500, response, requestId);
      }
      return;
    }

    if (pathname === "/v1/usage-events" && req.method === "POST") {
      if (!hasScope(authContext.scopes, "usage.write")) {
        error(res, 403, "FORBIDDEN", "missing scope usage.write", requestId);
        return;
      }
      const body = await readBody(req);
      const items = Array.isArray(body?.events) ? body.events : Array.isArray(body) ? body : body ? [body] : [];
      if (items.length === 0) {
        error(res, 400, "INVALID_REQUEST", "events required", requestId);
        return;
      }

      const idemKey = getIdempotencyKey(req, body);
      let idemResponse = null;
      if (idemKey) {
        const idem = await beginIdempotency(authContext.tenantId, pathname, idemKey, requestHash(body));
        if (idem.status === "conflict") {
          error(res, 409, "IDEMPOTENCY_CONFLICT", "idempotency key conflict", requestId);
          return;
        }
        if (idem.status === "replay") {
          json(res, idem.responseStatus, idem.responseBody, requestId);
          return;
        }
        if (idem.status === "processing") {
          error(res, 409, "IDEMPOTENCY_IN_PROGRESS", "idempotency key is processing", requestId);
          return;
        }
      }

      const normalized = items.map((item) => normalizeUsageEvent(item, config.settlementWindowSeconds));

      const thresholdCheck = enforceUsageThresholds(normalized);
      if (!thresholdCheck.ok) {
        await recordRisk(authContext.tenantId, "usage_threshold", { reason: thresholdCheck.reason });
        await triggerCircuit(authContext.tenantId, thresholdCheck.reason);
        error(res, 429, "RISK_BLOCKED", "usage thresholds exceeded", requestId);
        return;
      }

      for (const event of normalized) {
        const allowPayer = await checkAllowlist(authContext.tenantId, "payer", event.payer);
        const allowProvider = await checkAllowlist(authContext.tenantId, "provider", event.provider);
        const allowToken = await checkAllowlist(authContext.tenantId, "token", event.token);
        if (!allowPayer || !allowProvider || !allowToken) {
          await recordRisk(authContext.tenantId, "allowlist", {
            payer: event.payer,
            provider: event.provider,
            token: event.token,
          });
          error(res, 403, "ALLOWLIST_BLOCKED", "address not allowlisted", requestId);
          return;
        }
      }

      const stored = await insertUsageEvents(authContext.tenantId, normalized);
      const response = { accepted: stored, duplicates: normalized.length - stored };

      if (idemKey) {
        await completeIdempotency(authContext.tenantId, pathname, idemKey, 200, response);
      }

      json(res, 200, response, requestId);
      return;
    }

    if (pathname === "/v1/settlement/preview" && req.method === "POST") {
      if (!hasScope(authContext.scopes, "settlement.preview")) {
        error(res, 403, "FORBIDDEN", "missing scope settlement.preview", requestId);
        return;
      }
      const body = await readBody(req);
      const windowSeconds = Number(body?.windowSeconds ?? config.settlementWindowSeconds);
      const from = body?.from ?? null;
      const to = body?.to ?? null;

      const events =
        Array.isArray(body?.events) && body.events.length > 0
          ? body.events.map((item) => normalizeUsageEvent(item, windowSeconds))
          : (await loadUsageEvents(authContext.tenantId, { from, to })).map((item) =>
              normalizeUsageEvent(item, windowSeconds)
            );

      const windows = aggregateWindows(events, windowSeconds);
      const metrics = computeMetrics(events, windows);
      json(res, 200, { windowSeconds, metrics, windows }, requestId);
      return;
    }

    if (pathname === "/v1/settlement/submit" && req.method === "POST") {
      if (!hasScope(authContext.scopes, "settlement.submit")) {
        error(res, 403, "FORBIDDEN", "missing scope settlement.submit", requestId);
        return;
      }
      const body = await readBody(req);
      const windowSeconds = Number(body?.windowSeconds ?? config.settlementWindowSeconds);
      const from = body?.from ?? null;
      const to = body?.to ?? null;

      const idemKey = getIdempotencyKey(req, body);
      if (idemKey) {
        const idem = await beginIdempotency(authContext.tenantId, pathname, idemKey, requestHash(body));
        if (idem.status === "conflict") {
          error(res, 409, "IDEMPOTENCY_CONFLICT", "idempotency key conflict", requestId);
          return;
        }
        if (idem.status === "replay") {
          json(res, idem.responseStatus, idem.responseBody, requestId);
          return;
        }
        if (idem.status === "processing") {
          error(res, 409, "IDEMPOTENCY_IN_PROGRESS", "idempotency key is processing", requestId);
          return;
        }
      }

      const events =
        Array.isArray(body?.events) && body.events.length > 0
          ? body.events.map((item) => normalizeUsageEvent(item, windowSeconds))
          : (await loadUsageEvents(authContext.tenantId, { from, to })).map((item) =>
              normalizeUsageEvent(item, windowSeconds)
            );

      const windows = aggregateWindows(events, windowSeconds);
      const metrics = computeMetrics(events, windows);

      const rpcUrl = config.rpcUrl;
      const hubAddress = config.usageSettlementHub;
      const privateKey = process.env.PRIVATE_KEY ?? "";
      if (!rpcUrl || !hubAddress || !privateKey) {
        error(res, 500, "MISSING_ENV", "RPC_URL / USAGE_SETTLEMENT_HUB_ADDRESS / PRIVATE_KEY required", requestId);
        return;
      }

      const failed = [];
      const submitted = [];
      for (const window of windows) {
        const result = submitWindow(window, rpcUrl, hubAddress, privateKey);
        if (!result.ok) {
          failed.push({ window, error: result.error });
          await enqueueRetryWindow(authContext.tenantId, window, result.error);
          await recordSubmission(authContext.tenantId, window.windowId, "failed", "", result.error);
          continue;
        }
        submitted.push({ windowId: window.windowId, txHash: result.txHash });
        await recordSubmission(authContext.tenantId, window.windowId, "submitted", result.txHash, null);
      }

      const response = {
        windowSeconds,
        metrics,
        submitted,
        failedCount: failed.length,
      };

      if (idemKey) {
        await completeIdempotency(authContext.tenantId, pathname, idemKey, 200, response);
      }

      json(res, 200, response, requestId);
      return;
    }

    if (pathname === "/v1/settlement/retry" && req.method === "POST") {
      if (!hasScope(authContext.scopes, "settlement.retry")) {
        error(res, 403, "FORBIDDEN", "missing scope settlement.retry", requestId);
        return;
      }
      const rpcUrl = config.rpcUrl;
      const hubAddress = config.usageSettlementHub;
      const privateKey = process.env.PRIVATE_KEY ?? "";
      if (!rpcUrl || !hubAddress || !privateKey) {
        error(res, 500, "MISSING_ENV", "RPC_URL / USAGE_SETTLEMENT_HUB_ADDRESS / PRIVATE_KEY required", requestId);
        return;
      }

      const retryQueue = await loadRetryQueue(authContext.tenantId);
      if (retryQueue.length === 0) {
        json(res, 200, { submitted: [], failedCount: 0 }, requestId);
        return;
      }

      const failed = [];
      const submitted = [];
      for (const entry of retryQueue) {
        const result = submitWindow(entry.window, rpcUrl, hubAddress, privateKey);
        if (!result.ok) {
          failed.push({ window: entry.window, error: result.error });
          await enqueueRetryWindow(authContext.tenantId, entry.window, result.error);
          await recordSubmission(authContext.tenantId, entry.windowId, "failed", "", result.error);
          continue;
        }
        submitted.push({ windowId: entry.windowId, txHash: result.txHash });
        await clearRetryWindow(authContext.tenantId, entry.windowId);
        await recordSubmission(authContext.tenantId, entry.windowId, "submitted", result.txHash, null);
      }

      json(res, 200, { submitted, failedCount: failed.length }, requestId);
      return;
    }

    if (pathname === "/v1/settlement/metrics" && req.method === "GET") {
      if (!hasScope(authContext.scopes, "metrics.read")) {
        error(res, 403, "FORBIDDEN", "missing scope metrics.read", requestId);
        return;
      }
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      const events = (await loadUsageEvents(authContext.tenantId, { from, to })).map((item) =>
        normalizeUsageEvent(item, config.settlementWindowSeconds)
      );
      const windows = aggregateWindows(events, config.settlementWindowSeconds);
      const metrics = computeMetrics(events, windows);
      json(res, 200, { from, to, metrics }, requestId);
      return;
    }

    if (pathname === "/v1/settlement/audit" && req.method === "GET") {
      if (!hasScope(authContext.scopes, "audit.read")) {
        error(res, 403, "FORBIDDEN", "missing scope audit.read", requestId);
        return;
      }
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      const payer = searchParams.get("payer");
      const provider = searchParams.get("provider");
      const token = searchParams.get("token");
      const windowSeconds = Number(searchParams.get("windowSeconds") ?? config.settlementWindowSeconds);
      const format = (searchParams.get("format") ?? "json").toLowerCase();

      let events = (await loadUsageEvents(authContext.tenantId, { from, to })).map((item) =>
        normalizeUsageEvent(item, windowSeconds)
      );
      if (payer) events = events.filter((event) => event.payer.toLowerCase() === payer.toLowerCase());
      if (provider) events = events.filter((event) => event.provider.toLowerCase() === provider.toLowerCase());
      if (token) events = events.filter((event) => event.token.toLowerCase() === token.toLowerCase());

      const windows = aggregateWindows(events, windowSeconds);
      const metrics = computeMetrics(events, windows);
      const report = {
        tenantId: authContext.tenantId,
        generatedAtUtc: new Date().toISOString(),
        from,
        to,
        windowSeconds,
        metrics,
        windows: windows.map((window) => ({
          windowId: window.windowId,
          windowStart: window.windowStart,
          windowEnd: window.windowEnd,
          totalAmountWei: window.totalAmountWei.toString(),
          totalRequests: window.totalRequests,
          items: window.items.map((item) => ({
            payer: item.payer,
            provider: item.provider,
            token: item.token,
            amountWei: item.amountWei.toString(),
            requestCount: item.requestCount,
          })),
        })),
      };

      if (format === "csv") {
        text(res, 200, toCsvReport(windows), requestId);
      } else {
        json(res, 200, report, requestId);
      }
      return;
    }

    const payerMatch = pathname.match(/^\/v1\/payers\/([^/]+)\/escrow$/);
    if (payerMatch && req.method === "GET") {
      if (!hasScope(authContext.scopes, "escrow.read")) {
        error(res, 403, "FORBIDDEN", "missing scope escrow.read", requestId);
        return;
      }
      const payer = payerMatch[1];
      const token = searchParams.get("token");
      if (!config.rpcUrl || !config.usageSettlementHub) {
        error(res, 500, "MISSING_ENV", "RPC_URL / USAGE_SETTLEMENT_HUB_ADDRESS required", requestId);
        return;
      }
      if (!isAddress(payer) || !isAddress(token)) {
        error(res, 400, "INVALID_REQUEST", "invalid payer or token", requestId);
        return;
      }
      const value = castCall(
        config.usageSettlementHub,
        "payerEscrow(address,address)(uint256)",
        [payer, token],
        config.rpcUrl
      );
      json(res, 200, { payer, token, amount: value }, requestId);
      return;
    }

    const providerMatch = pathname.match(/^\/v1\/providers\/([^/]+)\/claimable$/);
    if (providerMatch && req.method === "GET") {
      if (!hasScope(authContext.scopes, "claimable.read")) {
        error(res, 403, "FORBIDDEN", "missing scope claimable.read", requestId);
        return;
      }
      const provider = providerMatch[1];
      const token = searchParams.get("token");
      if (!config.rpcUrl || !config.usageSettlementHub) {
        error(res, 500, "MISSING_ENV", "RPC_URL / USAGE_SETTLEMENT_HUB_ADDRESS required", requestId);
        return;
      }
      if (!isAddress(provider) || !isAddress(token)) {
        error(res, 400, "INVALID_REQUEST", "invalid provider or token", requestId);
        return;
      }
      const value = castCall(
        config.usageSettlementHub,
        "providerClaimable(address,address)(uint256)",
        [provider, token],
        config.rpcUrl
      );
      json(res, 200, { provider, token, amount: value }, requestId);
      return;
    }

    error(res, 404, "NOT_FOUND", "endpoint not found", requestId);
  } catch (err) {
    const message = err?.message ?? "internal error";
    if (message === "BODY_TOO_LARGE") {
      error(res, 413, "BODY_TOO_LARGE", "request body too large", requestId);
      return;
    }
    if (message === "UNAUTHORIZED") {
      error(res, 401, "UNAUTHORIZED", "Missing or invalid credentials", requestId);
      return;
    }
    if (message === "TENANT_DISABLED") {
      error(res, 403, "TENANT_DISABLED", "tenant disabled", requestId);
      return;
    }
    if (message.startsWith("JWT_")) {
      error(res, 401, "UNAUTHORIZED", message, requestId);
      return;
    }
    error(res, 500, "INTERNAL_ERROR", message, requestId);
    if (authContext?.tenantId) {
      await recordError(authContext.tenantId, message);
    }
  }
});

server.listen(config.port, config.host, () => {
  console.log(`[api] listening http://${config.host}:${config.port}`);
  console.log(`[api] db_dialect=${config.dbDialect}`);
  console.log(`[api] db_path=${config.dbDialect === "sqlite" ? config.dbPath : "-"}`);
  console.log(`[api] rpc_url=${config.rpcUrl || "-"}`);
  console.log(`[api] usage_settlement_hub=${config.usageSettlementHub || "-"}`);
  console.log(`[api] polkastream=${config.polkaStream || "-"}`);
  console.log(`[api] stream_trigger_operator=${config.streamTriggerOperatorAddress || "-"}`);
  console.log(`[api] cast_bin=${config.castBin}`);
});
