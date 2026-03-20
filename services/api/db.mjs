import path from "node:path";
import { mkdirSync } from "node:fs";

function formatSql(sql, params, dialect) {
  if (dialect !== "postgres") return { sql, params };
  let idx = 0;
  const formatted = sql.replace(/\?/g, () => `$${++idx}`);
  return { sql: formatted, params };
}

function makeAdapter(dialect, runner) {
  return {
    dialect,
    exec: async (sql) => {
      const { sql: text } = formatSql(sql, [], dialect);
      return runner.exec(text);
    },
    run: async (sql, params = []) => {
      const { sql: text, params: values } = formatSql(sql, params, dialect);
      return runner.run(text, values);
    },
    get: async (sql, params = []) => {
      const { sql: text, params: values } = formatSql(sql, params, dialect);
      return runner.get(text, values);
    },
    all: async (sql, params = []) => {
      const { sql: text, params: values } = formatSql(sql, params, dialect);
      return runner.all(text, values);
    },
    transaction: async (fn) => runner.transaction(fn),
    close: async () => runner.close?.(),
  };
}

export async function openDatabase(config) {
  if (config.dbDialect === "postgres") {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: config.databaseUrl });

    const runner = {
      exec: async (text) => pool.query(text),
      run: async (text, params) => pool.query(text, params),
      get: async (text, params) => {
        const res = await pool.query(text, params);
        return res.rows[0] ?? null;
      },
      all: async (text, params) => {
        const res = await pool.query(text, params);
        return res.rows;
      },
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const adapter = makeAdapter("postgres", {
            exec: async (text) => client.query(text),
            run: async (text, params) => client.query(text, params),
            get: async (text, params) => {
              const res = await client.query(text, params);
              return res.rows[0] ?? null;
            },
            all: async (text, params) => {
              const res = await client.query(text, params);
              return res.rows;
            },
            transaction: async (innerFn) => innerFn(adapter),
          });
          const result = await fn(adapter);
          await client.query("COMMIT");
          return result;
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      },
      close: async () => pool.end(),
    };

    return makeAdapter("postgres", runner);
  }

  const { default: BetterSqlite3 } = await import("better-sqlite3");
  const dbPath = path.resolve(config.dbPath);
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");

  const runner = {
    exec: (text) => sqlite.exec(text),
    run: (text, params) => sqlite.prepare(text).run(params),
    get: (text, params) => sqlite.prepare(text).get(params) ?? null,
    all: (text, params) => sqlite.prepare(text).all(params),
    transaction: async (fn) => {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(makeAdapter("sqlite", runner));
        sqlite.exec("COMMIT");
        return result;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
    close: () => sqlite.close(),
  };

  return makeAdapter("sqlite", runner);
}

export async function migrateDatabase(db) {
  const commonTables = {
    sqlite: [
      `CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        name TEXT,
        scopes TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS usage_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        request_id TEXT,
        payer TEXT NOT NULL,
        provider TEXT NOT NULL,
        token TEXT NOT NULL,
        usage_units TEXT NOT NULL,
        unit_price_wei TEXT NOT NULL,
        amount_wei TEXT NOT NULL,
        request_ts INTEGER NOT NULL,
        window_start INTEGER NOT NULL,
        window_end INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_event ON usage_events(tenant_id, event_id)`,
      `CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_ts ON usage_events(tenant_id, request_ts)`,
      `CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_window ON usage_events(tenant_id, window_start)`,
      `CREATE INDEX IF NOT EXISTS idx_usage_events_party ON usage_events(tenant_id, payer, provider, token)`,
      `CREATE TABLE IF NOT EXISTS idempotency_keys (
        tenant_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        idem_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        response_status INTEGER,
        response_body TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, endpoint, idem_key)
      )`,
      `CREATE TABLE IF NOT EXISTS rate_limits (
        scope TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (scope, window_start)
      )`,
      `CREATE TABLE IF NOT EXISTS tenant_circuit (
        tenant_id TEXT PRIMARY KEY,
        blocked_until INTEGER,
        reason TEXT,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS tenant_errors (
        tenant_id TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, window_start)
      )`,
      `CREATE TABLE IF NOT EXISTS settlement_retry_queue (
        tenant_id TEXT NOT NULL,
        window_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        last_error TEXT,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, window_id)
      )`,
      `CREATE TABLE IF NOT EXISTS settlement_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        window_id TEXT NOT NULL,
        tx_hash TEXT,
        status TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_settlement_submissions_window ON settlement_submissions(tenant_id, window_id)`,
      `CREATE TABLE IF NOT EXISTS risk_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        detail_json TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_risk_events_tenant_time ON risk_events(tenant_id, created_at)`,
      `CREATE TABLE IF NOT EXISTS allowlist (
        tenant_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        value TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT,
        PRIMARY KEY (tenant_id, kind, value)
      )`,
      `CREATE TABLE IF NOT EXISTS service_triggers (
        tenant_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        stream_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        trigger_mode TEXT NOT NULL,
        expected_trigger_policy TEXT,
        expected_service_ref TEXT,
        status TEXT NOT NULL,
        metadata_json TEXT,
        last_request_id TEXT,
        last_trigger_result TEXT,
        last_triggered_at TEXT,
        last_tx_hash TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, service_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_service_triggers_stream ON service_triggers(tenant_id, stream_id)`,
      `CREATE TABLE IF NOT EXISTS service_trigger_events (
        tenant_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        stream_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        tx_hash TEXT,
        error TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, service_id, request_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_service_trigger_events_stream ON service_trigger_events(tenant_id, stream_id, created_at)`,
    ],
    postgres: [
      `CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        name TEXT,
        scopes TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL,
        last_used_at TIMESTAMPTZ
      )`,
      `CREATE TABLE IF NOT EXISTS usage_events (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL,
        request_id TEXT,
        payer TEXT NOT NULL,
        provider TEXT NOT NULL,
        token TEXT NOT NULL,
        usage_units TEXT NOT NULL,
        unit_price_wei TEXT NOT NULL,
        amount_wei TEXT NOT NULL,
        request_ts BIGINT NOT NULL,
        window_start BIGINT NOT NULL,
        window_end BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_event ON usage_events(tenant_id, event_id)`,
      `CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_ts ON usage_events(tenant_id, request_ts)`,
      `CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_window ON usage_events(tenant_id, window_start)`,
      `CREATE INDEX IF NOT EXISTS idx_usage_events_party ON usage_events(tenant_id, payer, provider, token)`,
      `CREATE TABLE IF NOT EXISTS idempotency_keys (
        tenant_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        idem_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        response_status INTEGER,
        response_body TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (tenant_id, endpoint, idem_key)
      )`,
      `CREATE TABLE IF NOT EXISTS rate_limits (
        scope TEXT NOT NULL,
        window_start BIGINT NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (scope, window_start)
      )`,
      `CREATE TABLE IF NOT EXISTS tenant_circuit (
        tenant_id TEXT PRIMARY KEY,
        blocked_until BIGINT,
        reason TEXT,
        updated_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS tenant_errors (
        tenant_id TEXT NOT NULL,
        window_start BIGINT NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, window_start)
      )`,
      `CREATE TABLE IF NOT EXISTS settlement_retry_queue (
        tenant_id TEXT NOT NULL,
        window_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        last_error TEXT,
        updated_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (tenant_id, window_id)
      )`,
      `CREATE TABLE IF NOT EXISTS settlement_submissions (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        window_id TEXT NOT NULL,
        tx_hash TEXT,
        status TEXT NOT NULL,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_settlement_submissions_window ON settlement_submissions(tenant_id, window_id)`,
      `CREATE TABLE IF NOT EXISTS risk_events (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        detail_json TEXT,
        created_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_risk_events_tenant_time ON risk_events(tenant_id, created_at)`,
      `CREATE TABLE IF NOT EXISTS allowlist (
        tenant_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        value TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        created_by TEXT,
        PRIMARY KEY (tenant_id, kind, value)
      )`,
      `CREATE TABLE IF NOT EXISTS service_triggers (
        tenant_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        stream_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        trigger_mode TEXT NOT NULL,
        expected_trigger_policy TEXT,
        expected_service_ref TEXT,
        status TEXT NOT NULL,
        metadata_json TEXT,
        last_request_id TEXT,
        last_trigger_result TEXT,
        last_triggered_at TIMESTAMPTZ,
        last_tx_hash TEXT,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (tenant_id, service_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_service_triggers_stream ON service_triggers(tenant_id, stream_id)`,
      `CREATE TABLE IF NOT EXISTS service_trigger_events (
        tenant_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        stream_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        tx_hash TEXT,
        error TEXT,
        metadata_json TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (tenant_id, service_id, request_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_service_trigger_events_stream ON service_trigger_events(tenant_id, stream_id, created_at)`,
    ],
  };

  const statements = commonTables[db.dialect] ?? commonTables.sqlite;
  for (const stmt of statements) {
    await db.exec(stmt);
  }
}
