#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

INPUT_FILE="$ROOT_DIR/services/adapter/samples/openclaw_requests.jsonl"
USAGE_EVENTS_FILE="$TMP_DIR/usage_events.jsonl"
BATCHES_FILE="$TMP_DIR/batches.json"

if [ ! -f "$INPUT_FILE" ]; then
  echo "[ci_ai_settlement_check] missing sample input: $INPUT_FILE"
  exit 1
fi

node "$ROOT_DIR/services/adapter/openclaw_adapter.mjs" \
  --in "$INPUT_FILE" \
  --out "$USAGE_EVENTS_FILE" \
  --window-seconds 30

node "$ROOT_DIR/services/settlement-daemon/settlement_daemon.mjs" \
  --events "$USAGE_EVENTS_FILE" \
  --out "$BATCHES_FILE" \
  --window-seconds 30

node -e '
const fs = require("node:fs");
const path = process.argv[1];
const data = JSON.parse(fs.readFileSync(path, "utf8"));
if (!data || typeof data !== "object") throw new Error("invalid JSON payload");
if (!data.metrics || !Array.isArray(data.windows)) throw new Error("missing metrics/windows");
if (data.metrics.requestEvents <= 0) throw new Error("requestEvents must be > 0");
if (data.metrics.batchedWindows <= 0) throw new Error("batchedWindows must be > 0");
if (data.metrics.batchedWindows !== data.windows.length) throw new Error("batchedWindows != windows.length");
for (const [i, w] of data.windows.entries()) {
  if (!w.windowId || typeof w.windowId !== "string") throw new Error(`window ${i} missing windowId`);
  if (!Array.isArray(w.items) || w.items.length === 0) throw new Error(`window ${i} has no items`);
}
console.log(`[ci_ai_settlement_check] verified windows=${data.windows.length} requestEvents=${data.metrics.requestEvents}`);
' "$BATCHES_FILE"

echo "[ci_ai_settlement_check] PASS"
