#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { loadConfig } from "./config.mjs";
import { openDatabase, migrateDatabase } from "./db.mjs";
import { hashApiKey } from "./auth.mjs";

function usage() {
  console.log(`Usage:
  node services/api/admin.mjs create-tenant --id <tenant_id> --name <tenant_name>
  node services/api/admin.mjs create-api-key --tenant <tenant_id> --name <key_name> --scopes <comma_separated>
  node services/api/admin.mjs revoke-api-key --id <key_id>
  node services/api/admin.mjs allowlist add --tenant <tenant_id> --kind <token|payer|provider> --value <address> [--by <actor>]
  node services/api/admin.mjs allowlist remove --tenant <tenant_id> --kind <token|payer|provider> --value <address>
`);
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      out[key] = argv[i + 1] ?? "";
      i += 1;
    }
  }
  return out;
}

const [command, subcommand, ...rest] = process.argv.slice(2);
if (!command) {
  usage();
  process.exit(1);
}

const config = loadConfig();
const db = await openDatabase(config);
await migrateDatabase(db);

const flags = parseFlags(rest);

if (command === "create-tenant") {
  const id = flags.id?.trim();
  const name = flags.name?.trim();
  if (!id || !name) {
    usage();
    process.exit(1);
  }
  await db.run(
    "INSERT INTO tenants (id, name, status, created_at) VALUES (?, ?, 'active', ?) ON CONFLICT(id) DO NOTHING",
    [id, name, new Date().toISOString()]
  );
  console.log(`Tenant created: ${id}`);
  process.exit(0);
}

if (command === "create-api-key") {
  const tenant = flags.tenant?.trim();
  const name = flags.name?.trim() ?? "";
  const scopes = flags.scopes?.trim() ?? "";
  if (!tenant || !scopes) {
    usage();
    process.exit(1);
  }
  if (!config.apiKeySalt) {
    console.error("API_KEY_HASH_SALT is required to create API keys.");
    process.exit(1);
  }
  const rawKey = `psk_${randomBytes(24).toString("base64url")}`;
  const keyHash = hashApiKey(rawKey, config.apiKeySalt);
  const keyPrefix = rawKey.slice(0, 8);
  const keyId = `key_${randomBytes(8).toString("hex")}`;

  await db.run(
    "INSERT INTO api_keys (id, tenant_id, key_hash, key_prefix, name, scopes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)",
    [keyId, tenant, keyHash, keyPrefix, name, scopes, new Date().toISOString()]
  );

  console.log(`API key created for tenant ${tenant}`);
  console.log(`Key ID: ${keyId}`);
  console.log(`Key Prefix: ${keyPrefix}`);
  console.log(`API Key: ${rawKey}`);
  process.exit(0);
}

if (command === "revoke-api-key") {
  const id = flags.id?.trim();
  if (!id) {
    usage();
    process.exit(1);
  }
  await db.run("UPDATE api_keys SET status = 'revoked' WHERE id = ?", [id]);
  console.log(`API key revoked: ${id}`);
  process.exit(0);
}

if (command === "allowlist" && (subcommand === "add" || subcommand === "remove")) {
  const tenant = flags.tenant?.trim();
  const kind = flags.kind?.trim();
  const value = flags.value?.trim().toLowerCase();
  if (!tenant || !kind || !value) {
    usage();
    process.exit(1);
  }
  if (subcommand === "add") {
    const createdBy = flags.by?.trim() ?? "";
    await db.run(
      "INSERT INTO allowlist (tenant_id, kind, value, status, created_at, created_by) VALUES (?, ?, ?, 'active', ?, ?) ON CONFLICT(tenant_id, kind, value) DO UPDATE SET status = 'active', created_by = excluded.created_by",
      [tenant, kind, value, new Date().toISOString(), createdBy]
    );
    console.log(`Allowlist added: ${tenant} ${kind} ${value}`);
    process.exit(0);
  }

  if (subcommand === "remove") {
    await db.run(
      "UPDATE allowlist SET status = 'disabled' WHERE tenant_id = ? AND kind = ? AND value = ?",
      [tenant, kind, value]
    );
    console.log(`Allowlist removed: ${tenant} ${kind} ${value}`);
    process.exit(0);
  }
}

usage();
process.exit(1);
