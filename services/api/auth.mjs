import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function base64UrlDecode(input) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(base64, "base64").toString("utf8");
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseScopes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((value) => String(value));
  if (typeof raw === "string") return raw.split(/[\s,]+/).filter(Boolean);
  return [];
}

export function hashApiKey(key, salt) {
  return createHash("sha256").update(`${salt}:${key}`).digest("hex");
}

export function isJwtLike(token) {
  return token.split(".").length === 3;
}

export function verifyJwt(token, config) {
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("INVALID_JWT");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const headerJson = base64UrlDecode(encodedHeader);
  const payloadJson = base64UrlDecode(encodedPayload);
  let header;
  let payload;
  try {
    header = JSON.parse(headerJson);
    payload = JSON.parse(payloadJson);
  } catch {
    throw new Error("INVALID_JWT");
  }
  if (header?.alg !== "HS256") {
    throw new Error("UNSUPPORTED_JWT_ALG");
  }
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = base64UrlEncode(createHmac("sha256", config.jwtSecret).update(signingInput).digest());
  const sigBuffer = Buffer.from(encodedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error("INVALID_JWT_SIGNATURE");
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload?.nbf && now < Number(payload.nbf)) {
    throw new Error("JWT_NOT_ACTIVE");
  }
  if (payload?.exp && now >= Number(payload.exp)) {
    throw new Error("JWT_EXPIRED");
  }
  if (config.jwtIssuer && payload?.iss !== config.jwtIssuer) {
    throw new Error("JWT_ISSUER_MISMATCH");
  }
  if (config.jwtAudience) {
    const aud = payload?.aud;
    const audList = Array.isArray(aud) ? aud : aud ? [aud] : [];
    if (!audList.includes(config.jwtAudience)) {
      throw new Error("JWT_AUDIENCE_MISMATCH");
    }
  }

  const tenantId = payload?.tenant_id ?? payload?.tenantId ?? payload?.sub;
  if (!tenantId) {
    throw new Error("JWT_MISSING_TENANT");
  }
  const scopes = parseScopes(payload?.scope ?? payload?.scopes ?? payload?.scp);

  return { tenantId: String(tenantId), scopes, subject: payload?.sub ?? null, raw: payload };
}

export function hasScope(scopes, required) {
  if (!required) return true;
  if (!scopes || scopes.length === 0) return false;
  if (scopes.includes("*") || scopes.includes("admin")) return true;
  return scopes.includes(required);
}

export async function authenticateRequest(req, config, db) {
  const authHeader = req.headers.authorization ?? "";
  const apiKeyHeader = req.headers["x-api-key"] ?? req.headers["x-api-key".toLowerCase()] ?? "";

  const token = typeof apiKeyHeader === "string" && apiKeyHeader ? apiKeyHeader.trim() : "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const apiKeyToken = token || bearer;

  if (!apiKeyToken) {
    if (!config.requireAuth) {
      return { tenantId: config.defaultTenantId, scopes: ["*"], authType: "anonymous" };
    }
    throw new Error("UNAUTHORIZED");
  }

  if (config.authToken && apiKeyToken === config.authToken) {
    return { tenantId: config.defaultTenantId, scopes: ["*"], authType: "legacy" };
  }

  if (bearer && isJwtLike(bearer)) {
    const jwt = verifyJwt(bearer, config);
    return { tenantId: jwt.tenantId, scopes: jwt.scopes, authType: "jwt", subject: jwt.subject };
  }

  if (!config.apiKeySalt) {
    throw new Error("API_KEY_NOT_CONFIGURED");
  }

  const keyHash = hashApiKey(apiKeyToken, config.apiKeySalt);
  const apiKey = await db.get(
    "SELECT id, tenant_id, scopes, status FROM api_keys WHERE key_hash = ?",
    [keyHash]
  );
  if (!apiKey || apiKey.status !== "active") {
    throw new Error("UNAUTHORIZED");
  }

  const tenant = await db.get("SELECT id, status FROM tenants WHERE id = ?", [apiKey.tenant_id]);
  if (!tenant || tenant.status !== "active") {
    throw new Error("TENANT_DISABLED");
  }

  await db.run("UPDATE api_keys SET last_used_at = ? WHERE id = ?", [new Date().toISOString(), apiKey.id]);

  const scopes = parseScopes(apiKey.scopes);
  return { tenantId: apiKey.tenant_id, scopes, authType: "api_key", keyId: apiKey.id };
}
