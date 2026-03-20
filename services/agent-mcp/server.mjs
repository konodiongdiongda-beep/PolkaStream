#!/usr/bin/env node
import { createHash } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseAbi,
  zeroAddress,
  zeroHash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as z from "zod/v4";

const STREAM_STATUS_NAMES = ["NONE", "PENDING", "ACTIVE", "PAUSED", "COMPLETED", "CANCELED", "EXPIRED"];
const TRIGGER_POLICY_NAMES = [
  "NONE",
  "SENDER_ONLY",
  "RECEIVER_ONLY",
  "EITHER_PARTY",
  "BOTH_PARTIES",
  "AUTHORIZED_OPERATOR",
];

const POLKASTREAM_ABI = parseAbi([
  "function servicePlanRegistry() view returns (address)",
  "function createPendingStream(address receiver,uint256 deposit,uint256 durationInSeconds,uint256 cliffInSeconds,address token,uint256 activationDeadline,uint8 triggerPolicy,address authorizedActivator,bytes32 serviceRef) returns (uint256 streamId)",
  "function createPendingStreamFromPlan(uint256 planId,uint256 deposit,uint256 durationInSeconds,bytes32 serviceRef) returns (uint256 streamId)",
  "function confirmReadyBySender(uint256 streamId)",
  "function confirmReadyByReceiver(uint256 streamId)",
  "function activateStream(uint256 streamId)",
  "function cancelBeforeActivation(uint256 streamId)",
  "function getStreamCommercialState(uint256 streamId) view returns (uint8 status,uint8 triggerPolicy,uint256 createdAt,uint256 activatedAt,uint256 activationDeadline,address authorizedActivator,bytes32 serviceRef,bool senderConfirmed,bool receiverConfirmed)",
  "function getStreamPlanBinding(uint256 streamId) view returns (uint256 planId,bytes32 termsHash)"
]);

const SERVICE_PLAN_REGISTRY_ABI = parseAbi([
  "function createServicePlan(address token,uint256 minDeposit,uint256 maxDeposit,uint256 minDuration,uint256 maxDuration,uint256 cliffInSeconds,uint256 activationWindow,uint8 triggerPolicy,address authorizedActivator,bytes32 termsHash) returns (uint256 planId)",
  "function updateServicePlan(uint256 planId,address token,uint256 minDeposit,uint256 maxDeposit,uint256 minDuration,uint256 maxDuration,uint256 cliffInSeconds,uint256 activationWindow,uint8 triggerPolicy,address authorizedActivator,bytes32 termsHash)",
  "function setServicePlanActive(uint256 planId,bool isActive)",
  "function getPlan(uint256 planId) view returns (address provider,address token,uint256 minDeposit,uint256 maxDeposit,uint256 minDuration,uint256 maxDuration,uint256 cliffInSeconds,uint256 activationWindow,uint8 triggerPolicy,address authorizedActivator,bytes32 termsHash,bool isActive)",
  "function getProviderPlans(address provider) view returns (uint256[] planIds)"
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)"
]);

const addressSchema = z.string().refine((value) => isAddress(value), "Expected 0x address");
const uintLikeSchema = z.union([z.string(), z.number().int().nonnegative()]);
const bytes32LikeSchema = z.string().min(1);
const metadataSchema = z.record(z.string(), z.any()).optional();
const triggerPolicySchema = z.union([
  z.enum([
    "SENDER_ONLY",
    "RECEIVER_ONLY",
    "EITHER_PARTY",
    "BOTH_PARTIES",
    "AUTHORIZED_OPERATOR",
  ]),
  z.number().int().min(1).max(5),
  z.string().regex(/^[1-5]$/),
]);

const runtimeCache = {
  publicClient: null,
  walletClient: null,
  account: null,
  servicePlanRegistryAddress: null,
};

function readString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function firstEnv(keys, fallback = "") {
  for (const key of keys) {
    const value = readString(process.env[key]);
    if (value) return value;
  }
  return fallback;
}

function requireAddress(value, label) {
  if (!isAddress(value)) {
    throw new Error(`${label} is not configured as a valid address`);
  }
  return value;
}

function requireRpcUrl() {
  const rpcUrl = firstEnv(["POLKASTREAM_MCP_RPC_URL", "NEXT_PUBLIC_RPC_URL", "RPC_URL"]);
  if (!rpcUrl) {
    throw new Error("RPC URL is not configured. Set POLKASTREAM_MCP_RPC_URL or NEXT_PUBLIC_RPC_URL.");
  }
  return rpcUrl;
}

function getPublicClient() {
  if (!runtimeCache.publicClient) {
    runtimeCache.publicClient = createPublicClient({
      transport: http(requireRpcUrl()),
    });
  }
  return runtimeCache.publicClient;
}

function getAccount() {
  if (!runtimeCache.account) {
    const privateKey = firstEnv(["POLKASTREAM_MCP_PRIVATE_KEY", "PRIVATE_KEY"]);
    if (!privateKey) {
      throw new Error("Private key is not configured. Set POLKASTREAM_MCP_PRIVATE_KEY or PRIVATE_KEY.");
    }
    runtimeCache.account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  }
  return runtimeCache.account;
}

function getWalletClient() {
  if (!runtimeCache.walletClient) {
    runtimeCache.walletClient = createWalletClient({
      account: getAccount(),
      transport: http(requireRpcUrl()),
    });
  }
  return runtimeCache.walletClient;
}

function getPolkaStreamAddress() {
  return requireAddress(
    firstEnv(["POLKASTREAM_MCP_POLKASTREAM_ADDRESS", "NEXT_PUBLIC_POLKASTREAM_ADDRESS", "POLKASTREAM_ADDRESS"]),
    "PolkaStream contract address"
  );
}

function getApiBaseUrl() {
  const explicit = firstEnv(["POLKASTREAM_MCP_API_BASE_URL", "API_BASE_URL"]);
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const host = firstEnv(["API_HOST"], "127.0.0.1");
  const port = firstEnv(["API_PORT"], "8787");
  if (!port) {
    throw new Error("API base URL is not configured. Set POLKASTREAM_MCP_API_BASE_URL.");
  }

  const normalizedHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  return `http://${normalizedHost}:${port}`;
}

function getApiToken() {
  return firstEnv(["POLKASTREAM_MCP_API_TOKEN", "API_AUTH_TOKEN"]);
}

async function resolveServicePlanRegistryAddress() {
  if (runtimeCache.servicePlanRegistryAddress) {
    return runtimeCache.servicePlanRegistryAddress;
  }

  const explicit = firstEnv([
    "POLKASTREAM_MCP_SERVICE_PLAN_REGISTRY_ADDRESS",
    "SERVICE_PLAN_REGISTRY_ADDRESS",
  ]);
  if (explicit) {
    runtimeCache.servicePlanRegistryAddress = requireAddress(explicit, "ServicePlan registry address");
    return runtimeCache.servicePlanRegistryAddress;
  }

  const registryAddress = await getPublicClient().readContract({
    address: getPolkaStreamAddress(),
    abi: POLKASTREAM_ABI,
    functionName: "servicePlanRegistry",
  });

  if (!registryAddress || registryAddress === zeroAddress) {
    throw new Error(
      "ServicePlan registry address is not configured. Set POLKASTREAM_MCP_SERVICE_PLAN_REGISTRY_ADDRESS or configure PolkaStream.servicePlanRegistry onchain."
    );
  }

  runtimeCache.servicePlanRegistryAddress = registryAddress;
  return registryAddress;
}

function normalizeUint(value, label) {
  try {
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`${label} must be a non-negative safe integer or decimal string`);
      }
      return BigInt(value);
    }

    const text = String(value).trim();
    if (!/^\d+$/.test(text)) {
      throw new Error(`${label} must be an unsigned integer`);
    }

    return BigInt(text);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(`${label} must be an unsigned integer`);
  }
}

function normalizeOptionalUint(value) {
  if (value === undefined || value === null || value === "") {
    return 0n;
  }
  return normalizeUint(value, "value");
}

function normalizeBytes32(value, label) {
  if (value === undefined || value === null || value === "") {
    return zeroHash;
  }

  const text = String(value).trim();
  if (/^0x[a-fA-F0-9]{64}$/.test(text)) {
    return text;
  }

  return `0x${createHash("sha256").update(text).digest("hex")}`;
}

function normalizeTriggerPolicy(value) {
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 1 && value <= 5) {
      return value;
    }
    throw new Error("triggerPolicy must be between 1 and 5");
  }

  const text = String(value).trim().toUpperCase();
  if (/^[1-5]$/.test(text)) {
    return Number(text);
  }

  const idx = TRIGGER_POLICY_NAMES.indexOf(text);
  if (idx >= 1) {
    return idx;
  }

  throw new Error(`Unsupported triggerPolicy: ${value}`);
}

function resolveActivationDeadline({ activationDeadline, activationWindowSeconds }) {
  if (activationDeadline !== undefined && activationDeadline !== null && activationDeadline !== "") {
    return normalizeUint(activationDeadline, "activationDeadline");
  }

  if (activationWindowSeconds !== undefined && activationWindowSeconds !== null && activationWindowSeconds !== "") {
    return BigInt(Math.floor(Date.now() / 1000)) + normalizeUint(activationWindowSeconds, "activationWindowSeconds");
  }

  return 0n;
}

function formatTriggerPolicy(code) {
  return TRIGGER_POLICY_NAMES[Number(code)] ?? "UNKNOWN";
}

function formatStreamStatus(code) {
  return STREAM_STATUS_NAMES[Number(code)] ?? "UNKNOWN";
}

function formatCommercialState(result) {
  const [
    status,
    triggerPolicy,
    createdAt,
    activatedAt,
    activationDeadline,
    authorizedActivator,
    serviceRef,
    senderConfirmed,
    receiverConfirmed,
  ] = result;

  return {
    status: formatStreamStatus(status),
    statusCode: Number(status),
    triggerPolicy: formatTriggerPolicy(triggerPolicy),
    triggerPolicyCode: Number(triggerPolicy),
    createdAt: String(createdAt),
    activatedAt: String(activatedAt),
    activationDeadline: String(activationDeadline),
    authorizedActivator,
    serviceRef,
    senderConfirmed,
    receiverConfirmed,
  };
}

function formatPlan(result, planId = null) {
  const [
    provider,
    token,
    minDeposit,
    maxDeposit,
    minDuration,
    maxDuration,
    cliffInSeconds,
    activationWindow,
    triggerPolicy,
    authorizedActivator,
    termsHash,
    isActive,
  ] = result;

  return {
    ...(planId === null ? {} : { planId: String(planId) }),
    provider,
    token,
    minDeposit: String(minDeposit),
    maxDeposit: String(maxDeposit),
    minDuration: String(minDuration),
    maxDuration: String(maxDuration),
    cliffInSeconds: String(cliffInSeconds),
    activationWindow: String(activationWindow),
    triggerPolicy: formatTriggerPolicy(triggerPolicy),
    triggerPolicyCode: Number(triggerPolicy),
    authorizedActivator,
    termsHash,
    isActive,
  };
}

function toJsonSafe(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]));
  }

  return value;
}

function ok(result) {
  const safe = toJsonSafe(result);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(safe, null, 2),
      },
    ],
    structuredContent: safe,
  };
}

function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    isError: true,
  };
}

async function apiRequest(method, path, body, query) {
  const url = new URL(`${getApiBaseUrl()}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = {};
  const apiToken = getApiToken();
  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    const code = data?.code ? `${data.code}: ` : "";
    throw new Error(`${method} ${path} failed (${response.status}): ${code}${data?.message ?? response.statusText}`);
  }

  return data;
}

async function writeContract({ address, abi, functionName, args }) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const account = getAccount();

  const { request, result } = await publicClient.simulateContract({
    address,
    abi,
    functionName,
    args,
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return {
    account: account.address,
    contract: address,
    functionName,
    args,
    simulationResult: result,
    txHash: hash,
    receipt,
  };
}

async function readPolkaStream(functionName, args) {
  return getPublicClient().readContract({
    address: getPolkaStreamAddress(),
    abi: POLKASTREAM_ABI,
    functionName,
    args,
  });
}

async function writePolkaStream(functionName, args) {
  return writeContract({
    address: getPolkaStreamAddress(),
    abi: POLKASTREAM_ABI,
    functionName,
    args,
  });
}

async function readServicePlanRegistry(functionName, args) {
  return getPublicClient().readContract({
    address: await resolveServicePlanRegistryAddress(),
    abi: SERVICE_PLAN_REGISTRY_ABI,
    functionName,
    args,
  });
}

async function writeServicePlanRegistry(functionName, args) {
  return writeContract({
    address: await resolveServicePlanRegistryAddress(),
    abi: SERVICE_PLAN_REGISTRY_ABI,
    functionName,
    args,
  });
}

function registerJsonTool(name, config, handler) {
  server.registerTool(name, config, async (args) => {
    try {
      return ok(await handler(args ?? {}));
    } catch (error) {
      return fail(error);
    }
  });
}

const server = new McpServer({
  name: "polkastream-agent-mcp",
  version: "0.1.0",
});

registerJsonTool(
  "get_runtime_config",
  {
    description: "Read the MCP runtime configuration surface for PolkaStream, API, and ServicePlan integration.",
  },
  async () => {
    let registryAddress = null;
    try {
      registryAddress = await resolveServicePlanRegistryAddress();
    } catch {
      registryAddress = null;
    }

    const account = (() => {
      try {
        return getAccount().address;
      } catch {
        return null;
      }
    })();

    return {
      rpcUrl: requireRpcUrl(),
      polkaStream: getPolkaStreamAddress(),
      servicePlanRegistry: registryAddress,
      apiBaseUrl: getApiBaseUrl(),
      apiAuthConfigured: Boolean(getApiToken()),
      signer: account,
      usageSettlementHub: firstEnv([
        "POLKASTREAM_MCP_USAGE_SETTLEMENT_HUB_ADDRESS",
        "USAGE_SETTLEMENT_HUB_ADDRESS",
      ]) || null,
    };
  }
);

registerJsonTool(
  "get_token_allowance",
  {
    description: "Read ERC20 allowance for the current owner or a supplied owner/spender pair. Use before creating a pending stream.",
    inputSchema: {
      token: addressSchema,
      owner: addressSchema.optional().describe("Optional owner address. Defaults to MCP signer."),
      spender: addressSchema.optional().describe("Optional spender. Defaults to PolkaStream contract."),
    },
  },
  async ({ token, owner, spender }) => {
    const resolvedOwner = owner ?? getAccount().address;
    const resolvedSpender = spender ?? getPolkaStreamAddress();
    const allowance = await getPublicClient().readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [resolvedOwner, resolvedSpender],
    });

    return {
      token,
      owner: resolvedOwner,
      spender: resolvedSpender,
      allowance: String(allowance),
    };
  }
);

registerJsonTool(
  "approve_token_spend",
  {
    description: "Approve PolkaStream or another spender to pull ERC20 funds from the MCP signer wallet.",
    inputSchema: {
      token: addressSchema,
      amount: uintLikeSchema.describe("Approval amount in token base units. Prefer decimal string for wei values."),
      spender: addressSchema.optional().describe("Optional spender. Defaults to PolkaStream contract."),
    },
  },
  async ({ token, amount, spender }) => {
    const resolvedSpender = spender ?? getPolkaStreamAddress();
    const tx = await writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [resolvedSpender, normalizeUint(amount, "amount")],
    });

    return {
      approved: true,
      token,
      owner: tx.account,
      spender: resolvedSpender,
      amount: String(normalizeUint(amount, "amount")),
      txHash: tx.txHash,
      receipt: tx.receipt,
    };
  }
);

registerJsonTool(
  "create_pending_stream",
  {
    description: "Create a pending PolkaStream stream that locks budget now but starts billing only after activation.",
    inputSchema: {
      receiver: addressSchema,
      deposit: uintLikeSchema.describe("Deposit in token base units."),
      durationInSeconds: uintLikeSchema,
      cliffInSeconds: uintLikeSchema.optional(),
      token: addressSchema,
      activationDeadline: uintLikeSchema.optional().describe("Absolute unix timestamp. Optional."),
      activationWindowSeconds: uintLikeSchema.optional().describe("Relative activation window in seconds. Optional alternative to activationDeadline."),
      triggerPolicy: triggerPolicySchema,
      authorizedActivator: addressSchema.optional(),
      serviceRef: bytes32LikeSchema.optional().describe("Raw string or bytes32. Raw strings are SHA-256 hashed to bytes32."),
    },
  },
  async ({
    receiver,
    deposit,
    durationInSeconds,
    cliffInSeconds,
    token,
    activationDeadline,
    activationWindowSeconds,
    triggerPolicy,
    authorizedActivator,
    serviceRef,
  }) => {
    const triggerPolicyCode = normalizeTriggerPolicy(triggerPolicy);
    const resolvedActivator = triggerPolicyCode === 5 ? authorizedActivator ?? zeroAddress : zeroAddress;
    const tx = await writePolkaStream("createPendingStream", [
      receiver,
      normalizeUint(deposit, "deposit"),
      normalizeUint(durationInSeconds, "durationInSeconds"),
      normalizeOptionalUint(cliffInSeconds),
      token,
      resolveActivationDeadline({ activationDeadline, activationWindowSeconds }),
      triggerPolicyCode,
      resolvedActivator,
      normalizeBytes32(serviceRef, "serviceRef"),
    ]);

    const streamId = tx.simulationResult;
    const commercialState = await readPolkaStream("getStreamCommercialState", [streamId]);

    return {
      streamId: String(streamId),
      txHash: tx.txHash,
      sender: tx.account,
      receiver,
      token,
      deposit: String(normalizeUint(deposit, "deposit")),
      durationInSeconds: String(normalizeUint(durationInSeconds, "durationInSeconds")),
      cliffInSeconds: String(normalizeOptionalUint(cliffInSeconds)),
      triggerPolicy: formatTriggerPolicy(triggerPolicyCode),
      triggerPolicyCode,
      authorizedActivator: resolvedActivator,
      serviceRef: normalizeBytes32(serviceRef, "serviceRef"),
      commercialState: formatCommercialState(commercialState),
      receipt: tx.receipt,
    };
  }
);

registerJsonTool(
  "create_pending_stream_from_plan",
  {
    description: "Create a pending stream against a provider-owned ServicePlan.",
    inputSchema: {
      planId: uintLikeSchema,
      deposit: uintLikeSchema,
      durationInSeconds: uintLikeSchema,
      serviceRef: bytes32LikeSchema.optional().describe("Raw string or bytes32. Raw strings are SHA-256 hashed to bytes32."),
    },
  },
  async ({ planId, deposit, durationInSeconds, serviceRef }) => {
    const normalizedPlanId = normalizeUint(planId, "planId");
    const tx = await writePolkaStream("createPendingStreamFromPlan", [
      normalizedPlanId,
      normalizeUint(deposit, "deposit"),
      normalizeUint(durationInSeconds, "durationInSeconds"),
      normalizeBytes32(serviceRef, "serviceRef"),
    ]);

    const streamId = tx.simulationResult;
    const [bindingPlanId, termsHash] = await readPolkaStream("getStreamPlanBinding", [streamId]);
    const commercialState = await readPolkaStream("getStreamCommercialState", [streamId]);

    return {
      streamId: String(streamId),
      planId: String(bindingPlanId),
      txHash: tx.txHash,
      sender: tx.account,
      termsHash,
      commercialState: formatCommercialState(commercialState),
      receipt: tx.receipt,
    };
  }
);

registerJsonTool(
  "confirm_ready_by_sender",
  {
    description: "Mark the sender side as ready for a BOTH_PARTIES pending stream.",
    inputSchema: {
      streamId: uintLikeSchema,
    },
  },
  async ({ streamId }) => {
    const normalizedStreamId = normalizeUint(streamId, "streamId");
    const tx = await writePolkaStream("confirmReadyBySender", [normalizedStreamId]);
    const commercialState = await readPolkaStream("getStreamCommercialState", [normalizedStreamId]);

    return {
      streamId: String(normalizedStreamId),
      txHash: tx.txHash,
      account: tx.account,
      commercialState: formatCommercialState(commercialState),
      receipt: tx.receipt,
    };
  }
);

registerJsonTool(
  "confirm_ready_by_receiver",
  {
    description: "Mark the receiver side as ready for a BOTH_PARTIES pending stream.",
    inputSchema: {
      streamId: uintLikeSchema,
    },
  },
  async ({ streamId }) => {
    const normalizedStreamId = normalizeUint(streamId, "streamId");
    const tx = await writePolkaStream("confirmReadyByReceiver", [normalizedStreamId]);
    const commercialState = await readPolkaStream("getStreamCommercialState", [normalizedStreamId]);

    return {
      streamId: String(normalizedStreamId),
      txHash: tx.txHash,
      account: tx.account,
      commercialState: formatCommercialState(commercialState),
      receipt: tx.receipt,
    };
  }
);

registerJsonTool(
  "activate_stream",
  {
    description: "Activate a pending stream when its trigger conditions are satisfied.",
    inputSchema: {
      streamId: uintLikeSchema,
    },
  },
  async ({ streamId }) => {
    const normalizedStreamId = normalizeUint(streamId, "streamId");
    const tx = await writePolkaStream("activateStream", [normalizedStreamId]);
    const commercialState = await readPolkaStream("getStreamCommercialState", [normalizedStreamId]);

    return {
      streamId: String(normalizedStreamId),
      txHash: tx.txHash,
      activator: tx.account,
      commercialState: formatCommercialState(commercialState),
      receipt: tx.receipt,
    };
  }
);

registerJsonTool(
  "cancel_before_activation",
  {
    description: "Cancel a pending stream before activation and refund the sender escrow.",
    inputSchema: {
      streamId: uintLikeSchema,
    },
  },
  async ({ streamId }) => {
    const normalizedStreamId = normalizeUint(streamId, "streamId");
    const tx = await writePolkaStream("cancelBeforeActivation", [normalizedStreamId]);
    const commercialState = await readPolkaStream("getStreamCommercialState", [normalizedStreamId]);

    return {
      streamId: String(normalizedStreamId),
      txHash: tx.txHash,
      account: tx.account,
      commercialState: formatCommercialState(commercialState),
      receipt: tx.receipt,
    };
  }
);

registerJsonTool(
  "get_stream_commercial_state",
  {
    description: "Read the commercial state for a PolkaStream stream.",
    inputSchema: {
      streamId: uintLikeSchema,
    },
  },
  async ({ streamId }) => {
    const normalizedStreamId = normalizeUint(streamId, "streamId");
    const commercialState = await readPolkaStream("getStreamCommercialState", [normalizedStreamId]);

    return {
      streamId: String(normalizedStreamId),
      contract: getPolkaStreamAddress(),
      commercialState: formatCommercialState(commercialState),
    };
  }
);

registerJsonTool(
  "get_stream_plan_binding",
  {
    description: "Read the ServicePlan binding for a stream, including the bound terms hash.",
    inputSchema: {
      streamId: uintLikeSchema,
    },
  },
  async ({ streamId }) => {
    const normalizedStreamId = normalizeUint(streamId, "streamId");
    const [planId, termsHash] = await readPolkaStream("getStreamPlanBinding", [normalizedStreamId]);

    return {
      streamId: String(normalizedStreamId),
      planId: String(planId),
      termsHash,
    };
  }
);

registerJsonTool(
  "create_service_plan",
  {
    description: "Create a provider-owned ServicePlan that defines the commercial envelope before buyers fund a stream.",
    inputSchema: {
      token: addressSchema,
      minDeposit: uintLikeSchema,
      maxDeposit: uintLikeSchema,
      minDuration: uintLikeSchema,
      maxDuration: uintLikeSchema,
      cliffInSeconds: uintLikeSchema.optional(),
      activationWindow: uintLikeSchema.optional(),
      triggerPolicy: triggerPolicySchema,
      authorizedActivator: addressSchema.optional(),
      termsHash: bytes32LikeSchema.describe("Raw string or bytes32. Raw strings are SHA-256 hashed to bytes32."),
    },
  },
  async ({
    token,
    minDeposit,
    maxDeposit,
    minDuration,
    maxDuration,
    cliffInSeconds,
    activationWindow,
    triggerPolicy,
    authorizedActivator,
    termsHash,
  }) => {
    const triggerPolicyCode = normalizeTriggerPolicy(triggerPolicy);
    const resolvedActivator = triggerPolicyCode === 5 ? authorizedActivator ?? zeroAddress : zeroAddress;

    const tx = await writeServicePlanRegistry("createServicePlan", [
      token,
      normalizeUint(minDeposit, "minDeposit"),
      normalizeUint(maxDeposit, "maxDeposit"),
      normalizeUint(minDuration, "minDuration"),
      normalizeUint(maxDuration, "maxDuration"),
      normalizeOptionalUint(cliffInSeconds),
      normalizeOptionalUint(activationWindow),
      triggerPolicyCode,
      resolvedActivator,
      normalizeBytes32(termsHash, "termsHash"),
    ]);

    const planId = tx.simulationResult;
    const plan = await readServicePlanRegistry("getPlan", [planId]);

    return {
      planId: String(planId),
      provider: tx.account,
      registry: await resolveServicePlanRegistryAddress(),
      txHash: tx.txHash,
      plan: formatPlan(plan, planId),
      receipt: tx.receipt,
    };
  }
);

registerJsonTool(
  "update_service_plan",
  {
    description: "Update an existing ServicePlan owned by the MCP signer.",
    inputSchema: {
      planId: uintLikeSchema,
      token: addressSchema,
      minDeposit: uintLikeSchema,
      maxDeposit: uintLikeSchema,
      minDuration: uintLikeSchema,
      maxDuration: uintLikeSchema,
      cliffInSeconds: uintLikeSchema.optional(),
      activationWindow: uintLikeSchema.optional(),
      triggerPolicy: triggerPolicySchema,
      authorizedActivator: addressSchema.optional(),
      termsHash: bytes32LikeSchema.describe("Raw string or bytes32. Raw strings are SHA-256 hashed to bytes32."),
    },
  },
  async ({
    planId,
    token,
    minDeposit,
    maxDeposit,
    minDuration,
    maxDuration,
    cliffInSeconds,
    activationWindow,
    triggerPolicy,
    authorizedActivator,
    termsHash,
  }) => {
    const normalizedPlanId = normalizeUint(planId, "planId");
    const triggerPolicyCode = normalizeTriggerPolicy(triggerPolicy);
    const resolvedActivator = triggerPolicyCode === 5 ? authorizedActivator ?? zeroAddress : zeroAddress;

    const tx = await writeServicePlanRegistry("updateServicePlan", [
      normalizedPlanId,
      token,
      normalizeUint(minDeposit, "minDeposit"),
      normalizeUint(maxDeposit, "maxDeposit"),
      normalizeUint(minDuration, "minDuration"),
      normalizeUint(maxDuration, "maxDuration"),
      normalizeOptionalUint(cliffInSeconds),
      normalizeOptionalUint(activationWindow),
      triggerPolicyCode,
      resolvedActivator,
      normalizeBytes32(termsHash, "termsHash"),
    ]);

    const plan = await readServicePlanRegistry("getPlan", [normalizedPlanId]);

    return {
      planId: String(normalizedPlanId),
      provider: tx.account,
      registry: await resolveServicePlanRegistryAddress(),
      txHash: tx.txHash,
      plan: formatPlan(plan, normalizedPlanId),
      receipt: tx.receipt,
    };
  }
);

registerJsonTool(
  "set_service_plan_active",
  {
    description: "Activate or deactivate a ServicePlan.",
    inputSchema: {
      planId: uintLikeSchema,
      isActive: z.boolean(),
    },
  },
  async ({ planId, isActive }) => {
    const normalizedPlanId = normalizeUint(planId, "planId");
    const tx = await writeServicePlanRegistry("setServicePlanActive", [normalizedPlanId, isActive]);
    const plan = await readServicePlanRegistry("getPlan", [normalizedPlanId]);

    return {
      planId: String(normalizedPlanId),
      provider: tx.account,
      registry: await resolveServicePlanRegistryAddress(),
      txHash: tx.txHash,
      plan: formatPlan(plan, normalizedPlanId),
      receipt: tx.receipt,
    };
  }
);

registerJsonTool(
  "get_service_plan",
  {
    description: "Read a ServicePlan from the provider plan registry.",
    inputSchema: {
      planId: uintLikeSchema,
    },
  },
  async ({ planId }) => {
    const normalizedPlanId = normalizeUint(planId, "planId");
    const plan = await readServicePlanRegistry("getPlan", [normalizedPlanId]);

    return {
      registry: await resolveServicePlanRegistryAddress(),
      plan: formatPlan(plan, normalizedPlanId),
    };
  }
);

registerJsonTool(
  "get_provider_plans",
  {
    description: "List ServicePlan IDs for a provider and optionally include full plan details.",
    inputSchema: {
      provider: addressSchema,
      includeDetails: z.boolean().optional(),
    },
  },
  async ({ provider, includeDetails }) => {
    const planIds = await readServicePlanRegistry("getProviderPlans", [provider]);
    const plans = includeDetails
      ? await Promise.all(planIds.map(async (planId) => formatPlan(await readServicePlanRegistry("getPlan", [planId]), planId)))
      : undefined;

    return {
      provider,
      registry: await resolveServicePlanRegistryAddress(),
      planIds: planIds.map((planId) => String(planId)),
      ...(plans ? { plans } : {}),
    };
  }
);

registerJsonTool(
  "get_service_trigger",
  {
    description: "Read a registered commercial service trigger from the API layer.",
    inputSchema: {
      serviceId: z.string().min(1),
    },
  },
  async ({ serviceId }) => apiRequest("GET", `/v1/services/${encodeURIComponent(serviceId)}`)
);

registerJsonTool(
  "upsert_service_trigger",
  {
    description: "Create or update a service trigger that binds an API-facing service to a pending stream.",
    inputSchema: {
      serviceId: z.string().min(1),
      streamId: uintLikeSchema,
      provider: addressSchema,
      triggerMode: z.literal("on_request").optional(),
      expectedTriggerPolicy: z.union([triggerPolicySchema, z.string().min(1)]).optional(),
      serviceRef: bytes32LikeSchema.optional(),
      expectedServiceRef: bytes32LikeSchema.optional(),
      status: z.enum(["active", "inactive"]).optional(),
      metadata: metadataSchema,
    },
  },
  async ({
    serviceId,
    streamId,
    provider,
    triggerMode,
    expectedTriggerPolicy,
    serviceRef,
    expectedServiceRef,
    status,
    metadata,
  }) => {
    const payload = {
      streamId: String(normalizeUint(streamId, "streamId")),
      provider,
      ...(triggerMode ? { triggerMode } : {}),
      ...(expectedTriggerPolicy !== undefined
        ? {
            expectedTriggerPolicy:
              typeof expectedTriggerPolicy === "string" && !/^[1-5]$/.test(expectedTriggerPolicy)
                ? expectedTriggerPolicy
                : formatTriggerPolicy(normalizeTriggerPolicy(expectedTriggerPolicy)),
          }
        : {}),
      ...(serviceRef ? { serviceRef } : {}),
      ...(expectedServiceRef ? { expectedServiceRef } : {}),
      ...(status ? { status } : {}),
      ...(metadata ? { metadata } : {}),
    };

    return apiRequest("PUT", `/v1/services/${encodeURIComponent(serviceId)}`, payload);
  }
);

registerJsonTool(
  "trigger_service",
  {
    description: "Trigger commercial activation for a service on the first valid request.",
    inputSchema: {
      serviceId: z.string().min(1),
      requestId: z.string().min(1),
      streamId: uintLikeSchema.optional(),
      dryRun: z.boolean().optional(),
      metadata: metadataSchema,
    },
  },
  async ({ serviceId, requestId, streamId, dryRun, metadata }) => {
    const payload = {
      requestId,
      ...(streamId !== undefined ? { streamId: String(normalizeUint(streamId, "streamId")) } : {}),
      ...(dryRun !== undefined ? { dryRun } : {}),
      ...(metadata ? { metadata } : {}),
    };

    return apiRequest("POST", `/v1/services/${encodeURIComponent(serviceId)}/trigger`, payload);
  }
);

const usageEventInputSchema = z.object({
  requestId: z.string().optional(),
  eventId: z.string().optional(),
  payer: addressSchema,
  provider: addressSchema,
  token: addressSchema,
  usageUnits: uintLikeSchema,
  unitPriceWei: uintLikeSchema,
  amountWei: uintLikeSchema.optional(),
  requestTs: uintLikeSchema,
  windowStart: uintLikeSchema.optional(),
  windowEnd: uintLikeSchema.optional(),
});

registerJsonTool(
  "post_usage_events",
  {
    description: "Post one or more usage events into the sidecar settlement API.",
    inputSchema: {
      events: z.array(usageEventInputSchema).min(1),
    },
  },
  async ({ events }) => apiRequest("POST", "/v1/usage-events", { events })
);

registerJsonTool(
  "preview_settlement",
  {
    description: "Preview settlement windows for usage events without submitting onchain transactions.",
    inputSchema: {
      events: z.array(usageEventInputSchema).optional(),
      windowSeconds: uintLikeSchema.optional(),
    },
  },
  async ({ events, windowSeconds }) =>
    apiRequest("POST", "/v1/settlement/preview", {
      ...(events ? { events } : {}),
      ...(windowSeconds !== undefined ? { windowSeconds: Number(normalizeUint(windowSeconds, "windowSeconds")) } : {}),
    })
);

registerJsonTool(
  "submit_settlement",
  {
    description: "Submit usage settlement windows through the BFF/API layer.",
    inputSchema: {
      events: z.array(usageEventInputSchema).optional(),
      windowSeconds: uintLikeSchema.optional(),
    },
  },
  async ({ events, windowSeconds }) =>
    apiRequest("POST", "/v1/settlement/submit", {
      ...(events ? { events } : {}),
      ...(windowSeconds !== undefined ? { windowSeconds: Number(normalizeUint(windowSeconds, "windowSeconds")) } : {}),
    })
);

registerJsonTool(
  "retry_settlement",
  {
    description: "Retry previously failed settlement windows.",
  },
  async () => apiRequest("POST", "/v1/settlement/retry", {})
);

registerJsonTool(
  "get_payer_escrow",
  {
    description: "Read payer escrow balance through the BFF/API surface.",
    inputSchema: {
      payer: addressSchema,
      token: addressSchema,
    },
  },
  async ({ payer, token }) => apiRequest("GET", `/v1/payers/${payer}/escrow`, undefined, { token })
);

registerJsonTool(
  "get_provider_claimable",
  {
    description: "Read provider claimable balance through the BFF/API surface.",
    inputSchema: {
      provider: addressSchema,
      token: addressSchema,
    },
  },
  async ({ provider, token }) => apiRequest("GET", `/v1/providers/${provider}/claimable`, undefined, { token })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[polkastream-agent-mcp] stdio server ready");
}

main().catch((error) => {
  console.error("[polkastream-agent-mcp] fatal", error);
  process.exit(1);
});
