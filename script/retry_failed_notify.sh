#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: script/retry_failed_notify.sh [options]

Options:
  --rpc-url <url>          RPC endpoint (default: $RPC_URL or testnet default)
  --contract <address>     PolkaStream address (default: $POLKASTREAM_ADDRESS or $NEXT_PUBLIC_POLKASTREAM_ADDRESS)
  --from-block <block>     Start block (required)
  --to-block <block>       End block (default: latest)
  --stream-id <id>         Optional streamId filter
  --max-retries <count>    Max retry tx count (default: 20)
  --sleep-ms <ms>          Sleep between txs (default: 800)
  --private-key <key>      Private key for retry tx (default: $PRIVATE_KEY)
  --dry-run                Scan only, do not send tx
  -h, --help               Show help
USAGE
}

if ! command -v cast >/dev/null 2>&1; then
  echo "[retry-failed-notify] missing dependency: cast" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "[retry-failed-notify] missing dependency: jq" >&2
  exit 2
fi

RPC_URL="${RPC_URL:-https://services.polkadothub-rpc.com/testnet}"
CONTRACT="${POLKASTREAM_ADDRESS:-${NEXT_PUBLIC_POLKASTREAM_ADDRESS:-}}"
FROM_BLOCK=""
TO_BLOCK="latest"
STREAM_ID=""
MAX_RETRIES=20
SLEEP_MS=800
PRIVATE_KEY="${PRIVATE_KEY:-}"
DRY_RUN=0

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
    --stream-id)
      STREAM_ID="$2"
      shift 2
      ;;
    --max-retries)
      MAX_RETRIES="$2"
      shift 2
      ;;
    --sleep-ms)
      SLEEP_MS="$2"
      shift 2
      ;;
    --private-key)
      PRIVATE_KEY="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[retry-failed-notify] unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [ -z "$CONTRACT" ]; then
  echo "[retry-failed-notify] --contract or POLKASTREAM_ADDRESS is required" >&2
  exit 2
fi

if [ -z "$FROM_BLOCK" ]; then
  echo "[retry-failed-notify] --from-block is required" >&2
  exit 2
fi

if [ "$DRY_RUN" -eq 0 ] && [ -z "$PRIVATE_KEY" ]; then
  echo "[retry-failed-notify] --private-key or PRIVATE_KEY is required when not dry-run" >&2
  exit 2
fi

EVENT_SIG="NotifyStatusUpdated(uint256,uint256,uint8,uint32)"

echo "[retry-failed-notify] scanning ${EVENT_SIG} logs from ${FROM_BLOCK} to ${TO_BLOCK}"
logs_json="$(cast logs --json --rpc-url "$RPC_URL" --address "$CONTRACT" --from-block "$FROM_BLOCK" --to-block "$TO_BLOCK" "$EVENT_SIG")"

log_count="$(echo "$logs_json" | jq 'length')"
if [ "$log_count" -eq 0 ]; then
  echo "[retry-failed-notify] no NotifyStatusUpdated logs found"
  exit 0
fi

tmp_events="$(mktemp)"
tmp_failed="$(mktemp)"
err_file="$(mktemp)"
trap 'rm -f "$tmp_events" "$tmp_failed" "$err_file"' EXIT

echo "$logs_json" | jq -r '.[] | [.blockNumber, .logIndex, .topics[1], .topics[2], .data] | @tsv' \
  | while IFS=$'\t' read -r block_hex log_index_hex topic_stream topic_withdraw data; do
      stream_id=$((16#${topic_stream#0x}))
      withdraw_id=$((16#${topic_withdraw#0x}))
      status_hex="${data:2:64}"
      attempts_hex="${data:66:64}"
      status=$((16#${status_hex}))
      attempts=$((16#${attempts_hex}))
      block_num=$((16#${block_hex#0x}))
      log_index=$((16#${log_index_hex#0x}))
      printf "%s\t%s\t%s\t%s\t%s\t%s\n" "$block_num" "$log_index" "$stream_id" "$withdraw_id" "$status" "$attempts" >> "$tmp_events"
    done

sort -n -k1,1 -k2,2 "$tmp_events" \
  | awk -F'\t' -v stream_filter="$STREAM_ID" '
      {
        key = $4;
        last_stream[key] = $3;
        last_status[key] = $5;
        last_attempts[key] = $6;
      }
      END {
        for (k in last_status) {
          if (last_status[k] == 3 && (stream_filter == "" || last_stream[k] == stream_filter)) {
            print last_stream[k] "\t" k "\t" last_attempts[k];
          }
        }
      }
    ' | sort -n -k1,1 -k2,2 > "$tmp_failed"

failed_count="$(wc -l < "$tmp_failed" | tr -d ' ')"
if [ "$failed_count" -eq 0 ]; then
  echo "[retry-failed-notify] no FAILED notify records in selected range"
  exit 0
fi

echo "[retry-failed-notify] found FAILED records: ${failed_count}"

attempted=0
submitted=0
retry_success=0
retry_still_failed=0
retry_send_failed=0

sleep_secs="$(awk -v ms="$SLEEP_MS" 'BEGIN { printf "%.3f", ms / 1000 }')"

while IFS=$'\t' read -r stream_id withdraw_id last_attempts; do
  if [ "$attempted" -ge "$MAX_RETRIES" ]; then
    echo "[retry-failed-notify] reached --max-retries=${MAX_RETRIES}, stop"
    break
  fi

  attempted=$((attempted + 1))

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] streamId=${stream_id} withdrawId=${withdraw_id} lastAttempts=${last_attempts}"
    continue
  fi

  echo "[retry] streamId=${stream_id} withdrawId=${withdraw_id}"
  if send_json="$(cast send "$CONTRACT" "retryNotify(uint256,uint256)" "$stream_id" "$withdraw_id" --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL" --json 2>"$err_file")"; then
    submitted=$((submitted + 1))
    tx_hash="$(echo "$send_json" | jq -r '.transactionHash // .hash // "unknown"')"
    echo "[retry] submitted tx=${tx_hash}"

    status_after="$(cast call "$CONTRACT" "getNotifyStatus(uint256)(uint8,uint32,uint64)" "$withdraw_id" --rpc-url "$RPC_URL" --json | jq -r '.[0]')"

    if [ "$status_after" = "2" ]; then
      retry_success=$((retry_success + 1))
      echo "[retry] status=SUCCESS"
    else
      retry_still_failed=$((retry_still_failed + 1))
      echo "[retry] status_after=${status_after} (not SUCCESS)"
    fi
  else
    retry_send_failed=$((retry_send_failed + 1))
    err_msg="$(cat "$err_file" 2>/dev/null || true)"
    echo "[retry][fail] streamId=${stream_id} withdrawId=${withdraw_id} error=${err_msg}" >&2
  fi

  sleep "$sleep_secs"
done < "$tmp_failed"

summary_total="${failed_count}"
summary_attempted="${attempted}"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "[retry-failed-notify] summary total_failed=${summary_total} attempted=${summary_attempted} mode=dry-run"
else
  echo "[retry-failed-notify] summary total_failed=${summary_total} attempted=${summary_attempted} submitted=${submitted} retry_success=${retry_success} retry_still_failed=${retry_still_failed} send_failed=${retry_send_failed}"
fi
