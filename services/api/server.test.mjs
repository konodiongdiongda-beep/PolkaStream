import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

function hashHex(input) {
  return `0x${createHash("sha256").update(input).digest("hex")}`;
}

async function waitForServer(baseUrl, child) {
  const startedAt = Date.now();
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  while (Date.now() - startedAt < 15_000) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early: ${stderr || child.exitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/v1/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }

    await delay(150);
  }

  throw new Error(`server did not start: ${stderr}`);
}

async function writeFakeCast(binPath, stateFile) {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");

const args = process.argv.slice(2);
const stateFile = process.env.FAKE_CAST_STATE_FILE;
const operator = process.env.FAKE_CAST_OPERATOR_ADDRESS;

function readState() {
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

function writeState(next) {
  fs.writeFileSync(stateFile, JSON.stringify(next, null, 2));
}

if (args[0] === "wallet" && args[1] === "address") {
  process.stdout.write(operator + "\\n");
  process.exit(0);
}

if (args[0] === "calldata") {
  process.stdout.write("0xfeedface\\n");
  process.exit(0);
}

if (args[0] === "rpc" && args[1] === "eth_call") {
  process.stdout.write("0xdec0de\\n");
  process.exit(0);
}

if (args[0] === "decode-abi") {
  const state = readState();
  process.stdout.write(JSON.stringify([
    state.statusCode,
    state.triggerPolicyCode,
    state.createdAt,
    state.activatedAt,
    state.activationDeadline,
    state.authorizedActivator,
    state.serviceRef,
    false,
    false
  ]));
  process.exit(0);
}

if (args[0] === "send" && args[2] === "activateStream(uint256)") {
  const state = readState();
  state.sendCount = (state.sendCount || 0) + 1;

  if (state.statusCode !== 1) {
    writeState(state);
    process.stderr.write("STREAM_NOT_PENDING\\n");
    process.exit(1);
  }

  state.statusCode = 2;
  state.activatedAt = 1710000100;
  writeState(state);
  process.stdout.write(JSON.stringify({ transactionHash: "0xabc123" }));
  process.exit(0);
}

process.stderr.write("unsupported fake cast command: " + args.join(" ") + "\\n");
process.exit(1);
`;

  await writeFile(binPath, script, "utf8");
  await chmod(binPath, 0o755);
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const body = await response.json();
  return { status: response.status, body };
}

test("commercial trigger activates pending stream on first request and stays idempotent", async (t) => {
  const tmp = await mkdtemp(path.join(tmpdir(), "polkastream-api-test-"));
  const stateFile = path.join(tmp, "fake-cast-state.json");
  const castBin = path.join(tmp, "fake-cast");
  const dataDir = path.join(tmp, "data");
  const operatorAddress = "0x0000000000000000000000000000000000000c0d";
  const serviceRef = hashHex("openclaw-chat-v1");

  await writeFile(
    stateFile,
    JSON.stringify(
      {
        statusCode: 1,
        triggerPolicyCode: 5,
        createdAt: 1710000000,
        activatedAt: 0,
        activationDeadline: 1710003600,
        authorizedActivator: operatorAddress,
        serviceRef,
        sendCount: 0,
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFakeCast(castBin, stateFile);

  const port = 18000 + Math.floor(Math.random() * 2000);
  const child = spawn(
    process.execPath,
    ["services/api/server.mjs", "--host", "127.0.0.1", "--port", String(port), "--data-dir", dataDir],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        API_REQUIRE_AUTH: "false",
        NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:8545",
        NEXT_PUBLIC_POLKASTREAM_ADDRESS: "0x0000000000000000000000000000000000001234",
        STREAM_TRIGGER_PRIVATE_KEY: "0x1234",
        API_CAST_BIN: castBin,
        FAKE_CAST_STATE_FILE: stateFile,
        FAKE_CAST_OPERATOR_ADDRESS: operatorAddress,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  t.after(async () => {
    child.kill("SIGTERM");
    await delay(200);
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
    await rm(tmp, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl, child);

  const serviceUpsert = await requestJson(baseUrl, "/v1/services/openclaw-chat", {
    method: "PUT",
    body: JSON.stringify({
      streamId: "42",
      provider: "0x0000000000000000000000000000000000000b0b",
      triggerMode: "on_request",
      expectedTriggerPolicy: "AUTHORIZED_OPERATOR",
      serviceRef: "openclaw-chat-v1",
      metadata: {
        route: "/v1/chat/completions",
      },
    }),
  });

  assert.equal(serviceUpsert.status, 200);
  assert.equal(serviceUpsert.body.service.streamId, "42");
  assert.equal(serviceUpsert.body.commercialState.status, "PENDING");
  assert.equal(serviceUpsert.body.commercialState.serviceRef, serviceRef);

  const firstTrigger = await requestJson(baseUrl, "/v1/services/openclaw-chat/trigger", {
    method: "POST",
    body: JSON.stringify({
      requestId: "req-1",
      metadata: {
        path: "/v1/chat/completions",
      },
    }),
  });

  assert.equal(firstTrigger.status, 200);
  assert.equal(firstTrigger.body.result, "activated");
  assert.equal(firstTrigger.body.activationTxHash, "0xabc123");
  assert.equal(firstTrigger.body.commercialState.status, "ACTIVE");

  const replayTrigger = await requestJson(baseUrl, "/v1/services/openclaw-chat/trigger", {
    method: "POST",
    body: JSON.stringify({
      requestId: "req-1",
      metadata: {
        path: "/v1/chat/completions",
      },
    }),
  });

  assert.equal(replayTrigger.status, 200);
  assert.equal(replayTrigger.body.result, "activated");
  assert.equal(replayTrigger.body.activationTxHash, "0xabc123");

  const secondTrigger = await requestJson(baseUrl, "/v1/services/openclaw-chat/trigger", {
    method: "POST",
    body: JSON.stringify({
      requestId: "req-2",
      metadata: {
        path: "/v1/chat/completions",
      },
    }),
  });

  assert.equal(secondTrigger.status, 200);
  assert.equal(secondTrigger.body.result, "already_active");

  const commercialState = await requestJson(baseUrl, "/v1/streams/42/commercial-state");
  assert.equal(commercialState.status, 200);
  assert.equal(commercialState.body.commercialState.status, "ACTIVE");
  assert.equal(commercialState.body.operator.eligible, true);

  const state = JSON.parse(await readFile(stateFile, "utf8"));
  assert.equal(state.sendCount, 1);
});
