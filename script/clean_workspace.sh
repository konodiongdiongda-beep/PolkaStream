#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[clean] removing local build artifacts..."
rm -rf \
  "$ROOT_DIR/frontend/node_modules" \
  "$ROOT_DIR/frontend/dist" \
  "$ROOT_DIR/frontend/.vercel" \
  "$ROOT_DIR/out" \
  "$ROOT_DIR/broadcast" \
  "$ROOT_DIR/cache_forge"

echo "[clean] done"
