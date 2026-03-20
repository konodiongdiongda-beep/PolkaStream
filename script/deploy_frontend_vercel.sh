#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

if ! command -v vercel >/dev/null 2>&1; then
  echo "[deploy_frontend_vercel] vercel CLI not found"
  exit 1
fi

if [ ! -f "$FRONTEND_DIR/package.json" ]; then
  echo "[deploy_frontend_vercel] frontend/package.json not found"
  exit 1
fi

cd "$FRONTEND_DIR"

if [ "${1:-}" = "preview" ]; then
  if [ -n "${VERCEL_TOKEN:-}" ]; then
    vercel --yes --token "$VERCEL_TOKEN"
  else
    vercel --yes
  fi
  exit 0
fi

# default production
if [ -n "${VERCEL_TOKEN:-}" ]; then
  vercel --prod --yes --token "$VERCEL_TOKEN"
else
  vercel --prod --yes
fi
