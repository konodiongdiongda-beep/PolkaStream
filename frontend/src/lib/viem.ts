import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Address,
  type WalletClient,
} from "viem";

import type { WalletType } from "../types";

type Eip1193Provider = {
  isMetaMask?: boolean;
  isSubWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isCoinbaseBrowser?: boolean;
  isRabby?: boolean;
  isOKExWallet?: boolean;
  isOkxWallet?: boolean;
  isBraveWallet?: boolean;
  providers?: Eip1193Provider[];
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export const polkadotHubTestnet = defineChain({
  id: 420420417,
  name: "Polkadot Hub TestNet",
  network: "polkadot-hub-testnet",
  nativeCurrency: {
    name: "Test DOT",
    symbol: "DOT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://services.polkadothub-rpc.com/testnet"],
    },
    public: {
      http: ["https://services.polkadothub-rpc.com/testnet"],
    },
  },
  blockExplorers: {
    default: {
      name: "Polkadot Hub Explorer",
      url: "https://explorer-polkadot-hub.parity-testnet.parity.io",
    },
  },
  testnet: true,
});

const env = import.meta.env as Record<string, string | undefined>;

export const RPC_URL =
  env.NEXT_PUBLIC_RPC_URL ?? env.VITE_RPC_URL ?? "https://services.polkadothub-rpc.com/testnet";

export const POLKASTREAM_ADDRESS =
  (env.NEXT_PUBLIC_POLKASTREAM_ADDRESS ??
    env.VITE_POLKASTREAM_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as Address;

export const SERVICE_PLAN_REGISTRY_ADDRESS =
  (env.NEXT_PUBLIC_SERVICE_PLAN_REGISTRY_ADDRESS ??
    env.VITE_SERVICE_PLAN_REGISTRY_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as Address;

export const USAGE_SETTLEMENT_HUB_ADDRESS =
  (env.NEXT_PUBLIC_USAGE_SETTLEMENT_HUB_ADDRESS ??
    env.VITE_USAGE_SETTLEMENT_HUB_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as Address;

export const publicClient = createPublicClient({
  chain: polkadotHubTestnet,
  transport: http(RPC_URL),
});

export const polkaStreamAbi = [
  {
    type: "event",
    name: "StreamCreated",
    inputs: [
      { indexed: true, name: "streamId", type: "uint256" },
      { indexed: true, name: "sender", type: "address" },
      { indexed: true, name: "receiver", type: "address" },
      { indexed: false, name: "token", type: "address" },
      { indexed: false, name: "deposit", type: "uint256" },
      { indexed: false, name: "durationInSeconds", type: "uint256" },
      { indexed: false, name: "cliffInSeconds", type: "uint256" },
      { indexed: false, name: "startTime", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { indexed: true, name: "streamId", type: "uint256" },
      { indexed: true, name: "withdrawId", type: "uint256" },
      { indexed: true, name: "receiver", type: "address" },
      { indexed: false, name: "token", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "totalWithdrawn", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "StreamPaused",
    inputs: [
      { indexed: true, name: "streamId", type: "uint256" },
      { indexed: false, name: "pausedAt", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "StreamResumed",
    inputs: [
      { indexed: true, name: "streamId", type: "uint256" },
      { indexed: false, name: "resumedAt", type: "uint256" },
      { indexed: false, name: "pauseDuration", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "StreamCanceled",
    inputs: [
      { indexed: true, name: "streamId", type: "uint256" },
      { indexed: true, name: "sender", type: "address" },
      { indexed: true, name: "receiver", type: "address" },
      { indexed: false, name: "token", type: "address" },
      { indexed: false, name: "receiverPayout", type: "uint256" },
      { indexed: false, name: "senderRefund", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "NotifyStatusUpdated",
    inputs: [
      { indexed: true, name: "streamId", type: "uint256" },
      { indexed: true, name: "withdrawId", type: "uint256" },
      { indexed: false, name: "status", type: "uint8" },
      { indexed: false, name: "attempts", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "createStream",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "deposit", type: "uint256" },
      { name: "durationInSeconds", type: "uint256" },
      { name: "cliffInSeconds", type: "uint256" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "streamId", type: "uint256" }],
  },
  {
    type: "function",
    name: "createPendingStream",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "deposit", type: "uint256" },
      { name: "durationInSeconds", type: "uint256" },
      { name: "cliffInSeconds", type: "uint256" },
      { name: "token", type: "address" },
      { name: "activationDeadline", type: "uint256" },
      { name: "triggerPolicy", type: "uint8" },
      { name: "authorizedActivator", type: "address" },
      { name: "serviceRef", type: "bytes32" },
    ],
    outputs: [{ name: "streamId", type: "uint256" }],
  },
  {
    type: "function",
    name: "createPendingStreamFromPlan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "planId", type: "uint256" },
      { name: "deposit", type: "uint256" },
      { name: "durationInSeconds", type: "uint256" },
      { name: "serviceRef", type: "bytes32" },
    ],
    outputs: [{ name: "streamId", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelStream",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelBeforeActivation",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "pauseStream",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "activateStream",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmReadyBySender",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmReadyByReceiver",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resumeStream",
    stateMutability: "nonpayable",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getOwed",
    stateMutability: "view",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [{ name: "owed", type: "uint256" }],
  },
  {
    type: "function",
    name: "getStream",
    stateMutability: "view",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      {
        name: "stream",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "receiver", type: "address" },
          { name: "deposit", type: "uint256" },
          { name: "withdrawnAmount", type: "uint256" },
          { name: "durationInSeconds", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "cliffEndsAt", type: "uint256" },
          { name: "canceledAt", type: "uint256" },
          { name: "pausedAt", type: "uint256" },
          { name: "totalPausedDuration", type: "uint256" },
          { name: "isPaused", type: "bool" },
          { name: "isCanceled", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getStreamCommercialState",
    stateMutability: "view",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [
      { name: "status", type: "uint8" },
      { name: "triggerPolicy", type: "uint8" },
      { name: "createdAt", type: "uint256" },
      { name: "activatedAt", type: "uint256" },
      { name: "activationDeadline", type: "uint256" },
      { name: "authorizedActivator", type: "address" },
      { name: "serviceRef", type: "bytes32" },
      { name: "senderConfirmed", type: "bool" },
      { name: "receiverConfirmed", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getSenderStreams",
    stateMutability: "view",
    inputs: [{ name: "sender", type: "address" }],
    outputs: [{ name: "streamIds", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getReceiverStreams",
    stateMutability: "view",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "streamIds", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "tokenAllowlist",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isNotifierHealthy",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "servicePlanRegistry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "notifier",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "retryNotify",
    stateMutability: "nonpayable",
    inputs: [
      { name: "streamId", type: "uint256" },
      { name: "withdrawId", type: "uint256" },
    ],
    outputs: [{ name: "status", type: "uint8" }],
  },
  {
    type: "function",
    name: "getStreamWithdrawIds",
    stateMutability: "view",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [{ name: "withdrawIds", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getNotifyStatus",
    stateMutability: "view",
    inputs: [{ name: "withdrawId", type: "uint256" }],
    outputs: [
      { name: "status", type: "uint8" },
      { name: "attempts", type: "uint32" },
      { name: "lastAttemptAt", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "getStreamPlanBinding",
    stateMutability: "view",
    inputs: [{ name: "streamId", type: "uint256" }],
    outputs: [
      { name: "planId", type: "uint256" },
      { name: "termsHash", type: "bytes32" },
    ],
  },
] as const;

export const servicePlanRegistryAbi = [
  {
    type: "function",
    name: "getPlan",
    stateMutability: "view",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [
      { name: "provider", type: "address" },
      { name: "token", type: "address" },
      { name: "minDeposit", type: "uint256" },
      { name: "maxDeposit", type: "uint256" },
      { name: "minDuration", type: "uint256" },
      { name: "maxDuration", type: "uint256" },
      { name: "cliffInSeconds", type: "uint256" },
      { name: "activationWindow", type: "uint256" },
      { name: "triggerPolicy", type: "uint8" },
      { name: "authorizedActivator", type: "address" },
      { name: "termsHash", type: "bytes32" },
      { name: "isActive", type: "bool" },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export const usageSettlementHubAbi = [
  {
    type: "function",
    name: "tokenAllowlist",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "payerEscrow",
    stateMutability: "view",
    inputs: [
      { name: "payer", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "providerClaimable",
    stateMutability: "view",
    inputs: [
      { name: "provider", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "settledWindows",
    stateMutability: "view",
    inputs: [{ name: "windowId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function getProviderPool(): Eip1193Provider[] {
  if (typeof window === "undefined" || !window.ethereum) {
    return [];
  }

  const injected = window.ethereum;
  if (Array.isArray(injected.providers) && injected.providers.length > 0) {
    return injected.providers;
  }

  return [injected];
}

function pickProvider(type: WalletType): Eip1193Provider | undefined {
  const providers = getProviderPool();
  if (providers.length === 0) {
    return undefined;
  }

  switch (type) {
    case "subwallet":
      return providers.find((provider) => provider.isSubWallet);
    case "coinbase":
      return providers.find((provider) => provider.isCoinbaseWallet || provider.isCoinbaseBrowser);
    case "okx":
      return providers.find((provider) => provider.isOkxWallet || provider.isOKExWallet);
    case "rabby":
      return providers.find((provider) => provider.isRabby);
    case "brave":
      return providers.find((provider) => provider.isBraveWallet);
    case "metamask":
    default:
      return providers.find(
        (provider) =>
          provider.isMetaMask &&
          !provider.isSubWallet &&
          !provider.isRabby &&
          !provider.isCoinbaseWallet &&
          !provider.isCoinbaseBrowser &&
          !provider.isOKExWallet &&
          !provider.isOkxWallet &&
          !provider.isBraveWallet
      );
  }
}

export function isWalletInstalled(type: WalletType): boolean {
  return Boolean(pickProvider(type));
}

async function ensurePolkadotHubChain(provider: Eip1193Provider): Promise<void> {
  const chainIdHex = `0x${polkadotHubTestnet.id.toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;

    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: "Polkadot Hub TestNet",
            nativeCurrency: {
              name: "Test DOT",
              symbol: "DOT",
              decimals: 18,
            },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [
              "https://explorer-polkadot-hub.parity-testnet.parity.io",
            ],
          },
        ],
      });
      return;
    }

    throw error;
  }
}

export async function connectInjectedWallet(type: WalletType): Promise<{
  account: Address;
  walletClient: WalletClient;
  providerName: string;
}> {
  const provider = pickProvider(type);

  if (!provider) {
    throw new Error(`WALLET_NOT_FOUND:${type}`);
  }

  await ensurePolkadotHubChain(provider);

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts?.[0]) {
    throw new Error("钱包未返回可用账户");
  }

  const walletClient = createWalletClient({
    chain: polkadotHubTestnet,
    transport: custom(provider),
  });

  const providerName = (() => {
    switch (type) {
      case "subwallet":
        return "SubWallet";
      case "coinbase":
        return "Coinbase Wallet";
      case "okx":
        return "OKX Wallet";
      case "rabby":
        return "Rabby Wallet";
      case "brave":
        return "Brave Wallet";
      case "metamask":
      default:
        return "MetaMask";
    }
  })();

  return {
    account: accounts[0] as Address,
    walletClient,
    providerName,
  };
}

export function explorerTxUrl(hash: string): string {
  return `https://explorer-polkadot-hub.parity-testnet.parity.io/tx/${hash}`;
}
