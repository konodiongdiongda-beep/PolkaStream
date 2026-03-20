#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const out = {
    events: "",
    out: "services/settlement-daemon/output/batches.json",
    retryFile: "services/settlement-daemon/output/retry_queue.json",
    windowSeconds: 30,
    submit: false,
    retryOnly: false,
    rpcUrl: process.env.RPC_URL ?? "",
    privateKey: process.env.PRIVATE_KEY ?? "",
    hubAddress: process.env.HUB_ADDRESS ?? process.env.USAGE_SETTLEMENT_HUB_ADDRESS ?? "",
    maxWindows: 0,
    perRequestGas: 120000,
    perBatchBaseGas: 70000,
    perBatchItemGas: 30000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--events") {
      out.events = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--out") {
      out.out = argv[i + 1] ?? out.out;
      i += 1;
    } else if (arg === "--retry-file") {
      out.retryFile = argv[i + 1] ?? out.retryFile;
      i += 1;
    } else if (arg === "--window-seconds") {
      out.windowSeconds = Number(argv[i + 1] ?? "30");
      i += 1;
    } else if (arg === "--submit") {
      out.submit = true;
    } else if (arg === "--retry-only") {
      out.retryOnly = true;
    } else if (arg === "--rpc-url") {
      out.rpcUrl = argv[i + 1] ?? out.rpcUrl;
      i += 1;
    } else if (arg === "--private-key") {
      out.privateKey = argv[i + 1] ?? out.privateKey;
      i += 1;
    } else if (arg === "--hub-address") {
      out.hubAddress = argv[i + 1] ?? out.hubAddress;
      i += 1;
    } else if (arg === "--max-windows") {
      out.maxWindows = Number(argv[i + 1] ?? "0");
      i += 1;
    } else if (arg === "--per-request-gas") {
      out.perRequestGas = Number(argv[i + 1] ?? "120000");
      i += 1;
    } else if (arg === "--per-batch-base-gas") {
      out.perBatchBaseGas = Number(argv[i + 1] ?? "70000");
      i += 1;
    } else if (arg === "--per-batch-item-gas") {
      out.perBatchItemGas = Number(argv[i + 1] ?? "30000");
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      out.help = true;
    }
  }

  return out;
}

function usage() {
  console.log(`Usage:\n  node services/settlement-daemon/settlement_daemon.mjs --events <usage_events.jsonl> [--window-seconds 30] [--out <batches.json>]\n  node services/settlement-daemon/settlement_daemon.mjs --retry-only --retry-file <retry_queue.json> --submit --rpc-url <url> --hub-address <addr> --private-key <pk>\n\nOptions:\n  --submit            Broadcast settleWindow txs with cast\n  --retry-only        Submit windows from retry queue only\n  --max-windows N     Submit at most N windows (0 = no limit)`);
}

function mustUint(value, key) {
  const text = String(value);
  if (!/^\d+$/.test(text)) {
    throw new Error(`${key} must be unsigned integer`);
  }
  return BigInt(text);
}

function hashToBytes32(input) {
  return `0x${createHash("sha256").update(input).digest("hex")}`;
}

function toJsonWithBigInt(data) {
  return JSON.stringify(
    data,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
}

async function loadUsageEvents(eventsPath) {
  const raw = await readFile(eventsPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const events = lines.map((line, idx) => {
    const event = JSON.parse(line);
    const windowStart = Number(event.windowStart);
    const windowEnd = Number(event.windowEnd);
    if (!Number.isInteger(windowStart) || !Number.isInteger(windowEnd)) {
      throw new Error(`invalid window range in usage event line ${idx + 1}`);
    }
    return {
      ...event,
      amountWei: mustUint(event.amountWei, "amountWei"),
      requestTs: mustUint(event.requestTs, "requestTs"),
      windowStart,
      windowEnd,
    };
  });
  return events;
}

function aggregateWindows(events, windowSeconds) {
  const normalizedEvents = [...events].sort((a, b) => Number(a.requestTs - b.requestTs));

  const windows = new Map();
  for (const event of normalizedEvents) {
    const windowStart = Math.floor(Number(event.requestTs) / windowSeconds) * windowSeconds;
    const windowEnd = windowStart + windowSeconds;
    const windowKey = String(windowStart);

    if (!windows.has(windowKey)) {
      windows.set(windowKey, {
        windowStart,
        windowEnd,
        events: [],
        byParty: new Map(),
      });
    }

    const window = windows.get(windowKey);
    window.events.push(event);

    const itemKey = [
      String(event.payer).toLowerCase(),
      String(event.provider).toLowerCase(),
      String(event.token).toLowerCase(),
    ].join("|");

    if (!window.byParty.has(itemKey)) {
      window.byParty.set(itemKey, {
        payer: event.payer,
        provider: event.provider,
        token: event.token,
        amountWei: 0n,
        requestCount: 0,
      });
    }

    const item = window.byParty.get(itemKey);
    item.amountWei += event.amountWei;
    item.requestCount += 1;
  }

  const result = [];
  for (const [, window] of [...windows.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const items = [...window.byParty.values()].sort((a, b) => {
      const ka = `${a.payer}|${a.provider}|${a.token}`.toLowerCase();
      const kb = `${b.payer}|${b.provider}|${b.token}`.toLowerCase();
      return ka.localeCompare(kb);
    });

    const totalAmountWei = items.reduce((acc, item) => acc + item.amountWei, 0n);
    const totalRequests = items.reduce((acc, item) => acc + item.requestCount, 0);
    const payloadKey = [
      window.windowStart,
      window.windowEnd,
      items
        .map(
          (item) =>
            `${item.payer.toLowerCase()},${item.provider.toLowerCase()},${item.token.toLowerCase()},${item.amountWei.toString()},${item.requestCount}`
        )
        .join(";"),
    ].join("|");

    result.push({
      windowId: hashToBytes32(payloadKey),
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      requestEvents: window.events.length,
      totalAmountWei,
      totalRequests,
      items,
    });
  }

  return result;
}

function computeMetrics(events, windows, config) {
  const requestLevelTxCount = events.length;
  const batchedTxCount = windows.length;
  const txReductionPct =
    requestLevelTxCount === 0
      ? 0
      : ((requestLevelTxCount - batchedTxCount) * 100) / requestLevelTxCount;

  let totalLatency = 0;
  for (const event of events) {
    totalLatency += Math.max(0, event.windowEnd - Number(event.requestTs));
  }
  const avgLatencySeconds = events.length === 0 ? 0 : totalLatency / events.length;

  const requestLevelGas = requestLevelTxCount * config.perRequestGas;
  const batchedGas = windows.reduce(
    (acc, window) => acc + config.perBatchBaseGas + window.items.length * config.perBatchItemGas,
    0
  );
  const gasSavingPct = requestLevelGas === 0 ? 0 : ((requestLevelGas - batchedGas) * 100) / requestLevelGas;

  return {
    requestEvents: requestLevelTxCount,
    batchedWindows: batchedTxCount,
    txReductionPct: Number(txReductionPct.toFixed(2)),
    avgAggregationLatencySeconds: Number(avgLatencySeconds.toFixed(2)),
    throughputRequestsPerBatchTx:
      batchedTxCount === 0 ? 0 : Number((requestLevelTxCount / batchedTxCount).toFixed(2)),
    estimatedGas: {
      requestLevelGas,
      batchedGas,
      gasSavingPct: Number(gasSavingPct.toFixed(2)),
      assumptions: {
        perRequestGas: config.perRequestGas,
        perBatchBaseGas: config.perBatchBaseGas,
        perBatchItemGas: config.perBatchItemGas,
      },
    },
  };
}

function toTupleArray(items) {
  return `[${items
    .map(
      (item) =>
        `(${item.payer},${item.provider},${item.token},${item.amountWei.toString()},${item.requestCount})`
    )
    .join(",")}]`;
}

function submitWindow(window, args) {
  const castArgs = [
    "send",
    args.hubAddress,
    "settleWindow(bytes32,(address,address,address,uint256,uint32)[])",
    window.windowId,
    toTupleArray(window.items),
    "--private-key",
    args.privateKey,
    "--rpc-url",
    args.rpcUrl,
    "--json",
  ];

  const res = spawnSync("cast", castArgs, { encoding: "utf8" });
  if (res.status !== 0) {
    return {
      ok: false,
      error: (res.stderr || res.stdout || "cast send failed").trim(),
    };
  }

  let txHash = "";
  try {
    const parsed = JSON.parse(res.stdout || "{}");
    txHash = parsed.transactionHash ?? parsed.hash ?? "";
  } catch {
    txHash = "";
  }

  return {
    ok: true,
    txHash,
  };
}

async function loadRetryWindows(path) {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.windows)) {
    throw new Error("retry file must contain { windows: [...] }");
  }
  return parsed.windows.map((window) => ({
    ...window,
    totalAmountWei: mustUint(window.totalAmountWei, "totalAmountWei"),
    items: (window.items ?? []).map((item) => ({
      ...item,
      amountWei: mustUint(item.amountWei, "amountWei"),
      requestCount: Number(item.requestCount),
    })),
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  if (!Number.isInteger(args.windowSeconds) || args.windowSeconds <= 0) {
    throw new Error("--window-seconds must be positive integer");
  }

  let windows;
  let events = [];

  if (args.retryOnly) {
    windows = await loadRetryWindows(args.retryFile);
    console.log(`[daemon] retry_only=true windows=${windows.length}`);
  } else {
    if (!args.events) {
      throw new Error("--events is required when not using --retry-only");
    }
    events = await loadUsageEvents(args.events);
    windows = aggregateWindows(events, args.windowSeconds);
  }

  if (args.maxWindows > 0) {
    windows = windows.slice(0, args.maxWindows);
  }

  const metrics = computeMetrics(events, windows, args);

  const payload = {
    generatedAtUtc: new Date().toISOString(),
    windowSeconds: args.windowSeconds,
    metrics,
    windows,
  };

  await mkdir(args.out.split("/").slice(0, -1).join("/"), { recursive: true });
  await writeFile(args.out, toJsonWithBigInt(payload), "utf8");

  console.log(`[daemon] output=${args.out}`);
  console.log(`[daemon] request_events=${metrics.requestEvents}`);
  console.log(`[daemon] batched_windows=${metrics.batchedWindows}`);
  console.log(`[daemon] tx_reduction_pct=${metrics.txReductionPct}`);
  console.log(`[daemon] avg_latency_seconds=${metrics.avgAggregationLatencySeconds}`);
  console.log(`[daemon] throughput_req_per_batch_tx=${metrics.throughputRequestsPerBatchTx}`);
  console.log(`[daemon] estimated_request_level_gas=${metrics.estimatedGas.requestLevelGas}`);
  console.log(`[daemon] estimated_batched_gas=${metrics.estimatedGas.batchedGas}`);
  console.log(`[daemon] estimated_gas_saving_pct=${metrics.estimatedGas.gasSavingPct}`);

  if (!args.submit) {
    return;
  }

  if (!args.rpcUrl || !args.privateKey || !args.hubAddress) {
    throw new Error("--submit requires --rpc-url --private-key --hub-address (or env vars)");
  }

  const failed = [];
  let submitted = 0;

  for (const window of windows) {
    const result = submitWindow(window, args);
    if (!result.ok) {
      failed.push({ window, error: result.error });
      console.error(`[daemon][submit][fail] window=${window.windowId} error=${result.error}`);
      continue;
    }

    submitted += 1;
    console.log(`[daemon][submit][ok] window=${window.windowId} tx=${result.txHash || "unknown"}`);
  }

  if (failed.length > 0) {
    await mkdir(args.retryFile.split("/").slice(0, -1).join("/"), { recursive: true });
    await writeFile(
      args.retryFile,
      toJsonWithBigInt({
        generatedAtUtc: new Date().toISOString(),
        windows: failed.map((entry) => entry.window),
      }),
      "utf8"
    );
    console.log(`[daemon] retry_queue=${args.retryFile} failed_windows=${failed.length}`);
  }

  console.log(`[daemon] submit_summary submitted=${submitted} failed=${failed.length}`);
}

main().catch((error) => {
  console.error(`[daemon][error] ${error.message}`);
  process.exit(1);
});
