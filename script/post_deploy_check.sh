#!/usr/bin/env bash
set -euo pipefail

if ! command -v cast >/dev/null 2>&1; then
  echo "[post-deploy-check] missing dependency: cast" >&2
  exit 2
fi

RPC_URL="${RPC_URL:-${NEXT_PUBLIC_RPC_URL:-https://services.polkadothub-rpc.com/testnet}}"
POLKASTREAM_ADDRESS="${POLKASTREAM_ADDRESS:-${NEXT_PUBLIC_POLKASTREAM_ADDRESS:-}}"
EXPECTED_NOTIFIER="${EXPECTED_NOTIFIER:-${NOTIFIER_ADDRESS:-}}"
EXPECTED_STRICT_XCM="${EXPECTED_STRICT_XCM:-false}"
EXPECTED_MAX_DURATION="${EXPECTED_MAX_DURATION:-${MAX_DURATION:-31536000}}"
EXPECTED_MAX_DEPOSIT_PER_STREAM="${EXPECTED_MAX_DEPOSIT_PER_STREAM:-${MAX_DEPOSIT_PER_STREAM:-1000000000000000000000000000}}"
CHECK_ALLOWLIST="${CHECK_ALLOWLIST:-0xEe470D349633715a77A93B61E43eF0c881E8410B:true}"

if [ -z "${POLKASTREAM_ADDRESS}" ]; then
  echo "[post-deploy-check] POLKASTREAM_ADDRESS or NEXT_PUBLIC_POLKASTREAM_ADDRESS is required" >&2
  exit 2
fi

if [ -z "${EXPECTED_NOTIFIER}" ]; then
  echo "[post-deploy-check] EXPECTED_NOTIFIER or NOTIFIER_ADDRESS is required" >&2
  exit 2
fi

normalize_bool() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]'
}

normalize_addr() {
  echo "$1" | tr '[:upper:]' '[:lower:]'
}

failures=0
checks=0

check_equals() {
  local label="$1"
  local expected="$2"
  local actual="$3"

  checks=$((checks + 1))
  if [ "$expected" = "$actual" ]; then
    echo "[ok] ${label}: ${actual}"
    return
  fi

  failures=$((failures + 1))
  echo "[fail] ${label}: expected=${expected}, actual=${actual}" >&2
}

actual_notifier="$(cast call "$POLKASTREAM_ADDRESS" "notifier()(address)" --rpc-url "$RPC_URL" | tr -d '[:space:]')"
actual_strict_xcm="$(cast call "$POLKASTREAM_ADDRESS" "strictXcm()(bool)" --rpc-url "$RPC_URL" | tr -d '[:space:]')"
actual_notifier_health="$(cast call "$POLKASTREAM_ADDRESS" "isNotifierHealthy()(bool)" --rpc-url "$RPC_URL" | tr -d '[:space:]')"
actual_max_duration="$(cast call "$POLKASTREAM_ADDRESS" "maxDuration()(uint256)" --rpc-url "$RPC_URL" | awk '{print $1}')"
actual_max_deposit="$(cast call "$POLKASTREAM_ADDRESS" "maxDepositPerStream()(uint256)" --rpc-url "$RPC_URL" | awk '{print $1}')"

check_equals "notifier" "$(normalize_addr "$EXPECTED_NOTIFIER")" "$(normalize_addr "$actual_notifier")"
check_equals "strictXcm" "$(normalize_bool "$EXPECTED_STRICT_XCM")" "$(normalize_bool "$actual_strict_xcm")"
check_equals "isNotifierHealthy" "true" "$(normalize_bool "$actual_notifier_health")"
check_equals "maxDuration" "$EXPECTED_MAX_DURATION" "$actual_max_duration"
check_equals "maxDepositPerStream" "$EXPECTED_MAX_DEPOSIT_PER_STREAM" "$actual_max_deposit"

IFS=',' read -r -a allowlist_items <<< "$CHECK_ALLOWLIST"
for item in "${allowlist_items[@]}"; do
  pair="$(echo "$item" | tr -d '[:space:]')"
  if [ -z "$pair" ]; then
    continue
  fi

  token="${pair%%:*}"
  expected_state="${pair#*:}"
  if [ "$token" = "$expected_state" ]; then
    expected_state="true"
  fi

  actual_state="$(cast call "$POLKASTREAM_ADDRESS" "tokenAllowlist(address)(bool)" "$token" --rpc-url "$RPC_URL" | tr -d '[:space:]')"
  check_equals "tokenAllowlist(${token})" "$(normalize_bool "$expected_state")" "$(normalize_bool "$actual_state")"
done

echo "[post-deploy-check] completed checks=${checks}, failures=${failures}"
if [ "$failures" -ne 0 ]; then
  exit 1
fi
