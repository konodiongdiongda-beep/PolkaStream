import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function readNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function readString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function readList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadConfig() {
  const env = process.env;
  const dataDir = readString(env.API_DATA_DIR, path.join(__dirname, "data"));
  const dbPath = readString(env.API_DB_PATH, path.join(dataDir, "polkastream.db"));
  const databaseUrl = readString(env.API_DATABASE_URL, readString(env.DATABASE_URL));
  const dbDialect = /^postgres(ql)?:\/\//i.test(databaseUrl) ? "postgres" : "sqlite";

  const chainIdRaw = readString(env.NEXT_PUBLIC_CHAIN_ID, readString(env.CHAIN_ID));
  const chainId = chainIdRaw ? Number(chainIdRaw) : null;

  const authToken = readString(env.API_AUTH_TOKEN);
  const apiKeySalt = readString(env.API_KEY_HASH_SALT);
  const jwtSecret = readString(env.API_JWT_SECRET);
  const jwtIssuer = readString(env.API_JWT_ISSUER);
  const jwtAudience = readString(env.API_JWT_AUDIENCE);
  const requireAuth = readBool(env.API_REQUIRE_AUTH, Boolean(authToken || apiKeySalt || jwtSecret));

  return {
    chainId,
    host: readString(env.API_HOST, "0.0.0.0"),
    port: readNumber(env.API_PORT, 8787),
    dataDir,
    dbPath,
    databaseUrl,
    dbDialect,
    castBin: readString(env.API_CAST_BIN, "cast"),
    authToken,
    apiKeySalt,
    jwtSecret,
    jwtIssuer,
    jwtAudience,
    requireAuth,
    defaultTenantId: readString(env.API_DEFAULT_TENANT_ID, "default"),
    idempotencyTtlSeconds: readNumber(env.API_IDEMPOTENCY_TTL_SECONDS, 86_400),
    rateLimitGlobalPerMin: readNumber(env.API_RATE_LIMIT_GLOBAL_PER_MIN, 0),
    rateLimitTenantPerMin: readNumber(env.API_RATE_LIMIT_TENANT_PER_MIN, 0),
    circuitErrorThreshold: readNumber(env.API_CIRCUIT_ERROR_THRESHOLD, 20),
    circuitWindowSeconds: readNumber(env.API_CIRCUIT_WINDOW_SECONDS, 60),
    circuitCooldownSeconds: readNumber(env.API_CIRCUIT_COOLDOWN_SECONDS, 300),
    maxEventsPerRequest: readNumber(env.API_MAX_EVENTS_PER_REQUEST, 1000),
    maxEventAmountWei: readString(env.API_MAX_EVENT_AMOUNT_WEI, ""),
    maxTotalAmountWei: readString(env.API_MAX_TOTAL_AMOUNT_WEI, ""),
    allowlistEnforce: readBool(env.API_ALLOWLIST_ENFORCE, false),
    allowlistKinds: readList(env.API_ALLOWLIST_ENFORCE_KINDS),
    requestBodyLimitBytes: readNumber(env.API_MAX_BODY_BYTES, 2_000_000),
    rpcUrl: readString(env.NEXT_PUBLIC_RPC_URL, readString(env.RPC_URL)),
    polkaStream: readString(env.NEXT_PUBLIC_POLKASTREAM_ADDRESS, readString(env.POLKASTREAM_ADDRESS)),
    usageSettlementHub: readString(env.USAGE_SETTLEMENT_HUB_ADDRESS, readString(env.HUB_ADDRESS)),
    settlementWindowSeconds: readNumber(env.SETTLEMENT_WINDOW_SECONDS, 30),
    streamTriggerPrivateKey: readString(env.STREAM_TRIGGER_PRIVATE_KEY, readString(env.PRIVATE_KEY)),
    streamTriggerOperatorAddress: readString(env.STREAM_TRIGGER_OPERATOR_ADDRESS),
  };
}

export function publicConfig(config) {
  return {
    chainId: config.chainId ?? null,
    rpcUrl: config.rpcUrl,
    polkaStream: config.polkaStream,
    usageSettlementHub: config.usageSettlementHub,
    settlementWindowSeconds: config.settlementWindowSeconds,
  };
}

export function toSafeConfig(config) {
  return {
    chainId: config.chainId ?? null,
    rpcUrl: config.rpcUrl,
    polkaStream: config.polkaStream,
    usageSettlementHub: config.usageSettlementHub,
    settlementWindowSeconds: config.settlementWindowSeconds,
    serviceTrigger: {
      enabled: Boolean(config.rpcUrl && config.polkaStream && config.streamTriggerPrivateKey),
      operatorAddress: config.streamTriggerOperatorAddress || null,
      castBin: config.castBin,
    },
    auth: {
      requireAuth: config.requireAuth,
      allowApiKey: Boolean(config.apiKeySalt),
      allowJwt: Boolean(config.jwtSecret),
      allowLegacyToken: Boolean(config.authToken),
    },
    rateLimit: {
      globalPerMin: config.rateLimitGlobalPerMin,
      tenantPerMin: config.rateLimitTenantPerMin,
    },
    circuit: {
      errorThreshold: config.circuitErrorThreshold,
      windowSeconds: config.circuitWindowSeconds,
      cooldownSeconds: config.circuitCooldownSeconds,
    },
    allowlist: {
      enforce: config.allowlistEnforce,
      kinds: config.allowlistKinds,
    },
  };
}
