#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

function parseArgs(argv) {
  const out = {
    in: "",
    out: "services/adapter/output/usage_events.jsonl",
    windowSeconds: 30,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--in") {
      out.in = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--out") {
      out.out = argv[i + 1] ?? out.out;
      i += 1;
    } else if (arg === "--window-seconds") {
      out.windowSeconds = Number(argv[i + 1] ?? "30");
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      out.help = true;
    }
  }

  return out;
}

function usage() {
  console.log(`Usage: node services/adapter/openclaw_adapter.mjs --in <requests.jsonl> [--out <usage_events.jsonl>] [--window-seconds 30]\n\nInput line format (JSONL):\n{"requestId":"req-1","payer":"0x...","provider":"0x...","token":"0x...","usageUnits":"1200","unitPriceWei":"1000000000000","requestTs":1773052801}`);
}

function mustString(value, key, lineNo) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`line ${lineNo}: missing/invalid ${key}`);
  }
  return value;
}

function mustUint(value, key, lineNo) {
  const raw = value ?? "";
  const text = typeof raw === "number" ? String(Math.trunc(raw)) : String(raw);
  if (!/^\d+$/.test(text)) {
    throw new Error(`line ${lineNo}: ${key} must be unsigned integer`);
  }
  return BigInt(text);
}

function hashHex(input) {
  return `0x${createHash("sha256").update(input).digest("hex")}`;
}

function toWindow(ts, windowSeconds) {
  const sec = BigInt(windowSeconds);
  const t = BigInt(ts);
  const start = (t / sec) * sec;
  const end = start + sec;
  return { windowStart: Number(start), windowEnd: Number(end) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (!args.in) {
    throw new Error("--in is required");
  }
  if (!Number.isInteger(args.windowSeconds) || args.windowSeconds <= 0) {
    throw new Error("--window-seconds must be positive integer");
  }

  const raw = await readFile(args.in, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  const events = [];
  let totalAmount = 0n;

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const req = JSON.parse(lines[i]);

    const requestId = mustString(req.requestId, "requestId", lineNo);
    const payer = mustString(req.payer, "payer", lineNo);
    const provider = mustString(req.provider, "provider", lineNo);
    const token = mustString(req.token, "token", lineNo);

    const usageUnits = mustUint(req.usageUnits, "usageUnits", lineNo);
    const unitPriceWei = mustUint(req.unitPriceWei, "unitPriceWei", lineNo);
    const requestTs = mustUint(req.requestTs, "requestTs", lineNo);

    const amountWei = usageUnits * unitPriceWei;
    totalAmount += amountWei;

    const { windowStart, windowEnd } = toWindow(requestTs, args.windowSeconds);
    const eventId = hashHex(
      `${requestId}|${payer.toLowerCase()}|${provider.toLowerCase()}|${token.toLowerCase()}|${requestTs.toString()}|${usageUnits.toString()}|${unitPriceWei.toString()}`
    );

    events.push({
      type: "usage_event",
      version: 1,
      eventId,
      requestId,
      payer,
      provider,
      token,
      usageUnits: usageUnits.toString(),
      unitPriceWei: unitPriceWei.toString(),
      amountWei: amountWei.toString(),
      requestTs: requestTs.toString(),
      windowStart,
      windowEnd,
    });
  }

  await mkdir(args.out.split("/").slice(0, -1).join("/"), { recursive: true });
  const outText = events.map((event) => JSON.stringify(event)).join("\n") + "\n";
  await writeFile(args.out, outText, "utf8");

  console.log(`[adapter] input_requests=${lines.length}`);
  console.log(`[adapter] usage_events=${events.length}`);
  console.log(`[adapter] total_amount_wei=${totalAmount.toString()}`);
  console.log(`[adapter] output=${args.out}`);
}

main().catch((error) => {
  console.error(`[adapter][error] ${error.message}`);
  process.exit(1);
});
