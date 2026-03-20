#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ops/metrics/export_weekly_metrics.sh [options]

Options:
  --rpc-url <url>         RPC endpoint (default: $RPC_URL or testnet default)
  --contract <address>    PolkaStream address (default: $POLKASTREAM_ADDRESS or $NEXT_PUBLIC_POLKASTREAM_ADDRESS)
  --from-block <block>    Start block (required)
  --to-block <block>      End block (default: latest)
  --label <name>          Report label (default: weekly-<from>-<to>)
  --out-dir <dir>         Output directory (default: ops/metrics/output)
  -h, --help              Show help
USAGE
}

if ! command -v cast >/dev/null 2>&1; then
  echo "[metrics] missing dependency: cast" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "[metrics] missing dependency: jq" >&2
  exit 2
fi

RPC_URL="${RPC_URL:-https://services.polkadothub-rpc.com/testnet}"
CONTRACT="${POLKASTREAM_ADDRESS:-${NEXT_PUBLIC_POLKASTREAM_ADDRESS:-}}"
FROM_BLOCK=""
TO_BLOCK="latest"
LABEL=""
OUT_DIR="ops/metrics/output"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --rpc-url)
      RPC_URL="$2"
      shift 2
      ;;
    --contract)
      CONTRACT="$2"
      shift 2
      ;;
    --from-block)
      FROM_BLOCK="$2"
      shift 2
      ;;
    --to-block)
      TO_BLOCK="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[metrics] unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [ -z "$CONTRACT" ]; then
  echo "[metrics] --contract or POLKASTREAM_ADDRESS is required" >&2
  exit 2
fi

if [ -z "$FROM_BLOCK" ]; then
  echo "[metrics] --from-block is required" >&2
  exit 2
fi

if [ -z "$LABEL" ]; then
  LABEL="weekly-${FROM_BLOCK}-${TO_BLOCK}"
fi

mkdir -p "$OUT_DIR"

STREAM_CREATED_SIG="StreamCreated(uint256,address,address,address,uint256,uint256,uint256,uint256)"
WITHDRAWN_SIG="Withdrawn(uint256,uint256,address,address,uint256,uint256)"
NOTIFY_SIG="NotifyStatusUpdated(uint256,uint256,uint8,uint32)"

stream_created_logs="$(cast logs --json --rpc-url "$RPC_URL" --address "$CONTRACT" --from-block "$FROM_BLOCK" --to-block "$TO_BLOCK" "$STREAM_CREATED_SIG")"
withdrawn_logs="$(cast logs --json --rpc-url "$RPC_URL" --address "$CONTRACT" --from-block "$FROM_BLOCK" --to-block "$TO_BLOCK" "$WITHDRAWN_SIG")"
notify_logs="$(cast logs --json --rpc-url "$RPC_URL" --address "$CONTRACT" --from-block "$FROM_BLOCK" --to-block "$TO_BLOCK" "$NOTIFY_SIG")"

streams_created="$(echo "$stream_created_logs" | jq 'length')"
withdraw_success_count="$(echo "$withdrawn_logs" | jq 'length')"

notify_total=0
notify_failed=0
withdraw_attempt_proxy=0
retry_attempts=0
retry_success=0

while IFS= read -r data; do
  if [ -z "$data" ]; then
    continue
  fi

  status_hex="${data:2:64}"
  attempts_hex="${data:66:64}"
  status=$((16#${status_hex}))
  attempts=$((16#${attempts_hex}))

  notify_total=$((notify_total + 1))
  if [ "$status" -eq 3 ]; then
    notify_failed=$((notify_failed + 1))
  fi

  if [ "$attempts" -eq 1 ]; then
    withdraw_attempt_proxy=$((withdraw_attempt_proxy + 1))
  fi

  if [ "$attempts" -gt 1 ]; then
    retry_attempts=$((retry_attempts + 1))
    if [ "$status" -eq 2 ]; then
      retry_success=$((retry_success + 1))
    fi
  fi
done < <(echo "$notify_logs" | jq -r '.[] | .data')

pct() {
  awk -v n="$1" -v d="$2" 'BEGIN { if (d == 0) { printf "0.00" } else { printf "%.2f", (n * 100) / d } }'
}

withdraw_success_proxy_rate_pct="$(pct "$withdraw_success_count" "$withdraw_attempt_proxy")"
notify_failure_rate_pct="$(pct "$notify_failed" "$notify_total")"
retry_success_rate_pct="$(pct "$retry_success" "$retry_attempts")"

generated_at_utc="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
csv_path="${OUT_DIR}/${LABEL}.csv"
md_path="${OUT_DIR}/${LABEL}.md"

cat > "$csv_path" <<CSV
window_label,from_block,to_block,streams_created,withdraw_success_count,withdraw_attempt_proxy,withdraw_success_proxy_rate_pct,notify_attempts,notify_failed,notify_failure_rate_pct,retry_attempts,retry_success,retry_success_rate_pct,generated_at_utc
${LABEL},${FROM_BLOCK},${TO_BLOCK},${streams_created},${withdraw_success_count},${withdraw_attempt_proxy},${withdraw_success_proxy_rate_pct},${notify_total},${notify_failed},${notify_failure_rate_pct},${retry_attempts},${retry_success},${retry_success_rate_pct},${generated_at_utc}
CSV

cat > "$md_path" <<MD
# Weekly Metrics Report: ${LABEL}

- GeneratedAtUTC: ${generated_at_utc}
- Contract: ${CONTRACT}
- BlockRange: ${FROM_BLOCK} -> ${TO_BLOCK}

| Metric | Value |
| --- | ---: |
| Streams Created | ${streams_created} |
| Withdraw Success Count | ${withdraw_success_count} |
| Withdraw Attempt Proxy | ${withdraw_attempt_proxy} |
| Withdraw Success Proxy Rate | ${withdraw_success_proxy_rate_pct}% |
| Notify Attempts | ${notify_total} |
| Notify Failed | ${notify_failed} |
| Notify Failure Rate | ${notify_failure_rate_pct}% |
| Retry Attempts | ${retry_attempts} |
| Retry Success | ${retry_success} |
| Retry Success Rate | ${retry_success_rate_pct}% |

## Notes
- Withdraw Success Proxy Rate = Withdrawn events / NotifyStatusUpdated events with attempts=1.
- Notify Failure Rate = status=FAILED events / all NotifyStatusUpdated events.
- Retry Success Rate = attempts>1 and status=SUCCESS / all attempts>1 events.
MD

echo "[metrics] csv: ${csv_path}"
echo "[metrics] md: ${md_path}"
