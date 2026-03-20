import type { Address } from "viem";

export type Page =
  | "dashboard"
  | "streams"
  | "create-stream"
  | "settlements"
  | "ops"
  | "settings";

export type WalletType = "metamask" | "subwallet" | "coinbase" | "okx" | "rabby" | "brave";

export type WalletAvailability = Record<WalletType, boolean>;

export type NotifyFailureItem = {
  withdrawId: bigint;
  attempts: number;
  lastAttemptAt: bigint;
};

export type StreamRole = "sender" | "receiver";

export type CreateMode = "immediate" | "pending" | "plan";

export type TriggerPolicyName =
  | "NONE"
  | "SENDER_ONLY"
  | "RECEIVER_ONLY"
  | "EITHER_PARTY"
  | "BOTH_PARTIES"
  | "AUTHORIZED_OPERATOR";

export type StreamLifecycleStatus =
  | "pending"
  | "active"
  | "paused"
  | "completed"
  | "canceled"
  | "expired";

export type StreamCardData = {
  streamId: bigint;
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  sender: Address;
  receiver: Address;
  deposit: bigint;
  withdrawnAmount: bigint;
  durationInSeconds: bigint;
  startTime: bigint;
  cliffEndsAt: bigint;
  canceledAt: bigint;
  createdAt: bigint;
  activatedAt: bigint;
  activationDeadline: bigint;
  status: StreamLifecycleStatus;
  triggerPolicyCode: number;
  triggerPolicyName: TriggerPolicyName;
  authorizedActivator: Address;
  serviceRef: `0x${string}`;
  senderConfirmed: boolean;
  receiverConfirmed: boolean;
  planId: bigint;
  planTermsHash: `0x${string}`;
  isPaused: boolean;
  isCanceled: boolean;
  owed: bigint;
  role: StreamRole;
  failedNotifies: NotifyFailureItem[];
};

export type ActionType =
  | "withdraw"
  | "pause"
  | "resume"
  | "cancel"
  | "activate"
  | "cancelPending"
  | "confirmSender"
  | "confirmReceiver";

export type TokenMeta = {
  symbol: string;
  decimals: number;
};

export type PresetToken = {
  symbol: string;
  address: Address;
};

export type ServicePlanPreview = {
  registry: Address;
  planId: bigint;
  provider: Address;
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  minDeposit: bigint;
  maxDeposit: bigint;
  minDuration: bigint;
  maxDuration: bigint;
  cliffInSeconds: bigint;
  activationWindow: bigint;
  triggerPolicyCode: number;
  triggerPolicyName: TriggerPolicyName;
  authorizedActivator: Address;
  termsHash: `0x${string}`;
  isActive: boolean;
};

export type PreflightState = {
  chainOk: boolean;
  contractOk: boolean;
  notifierOk: boolean;
  tokenAllowed: boolean | null;
  checkedToken: Address | null;
  reason: string;
};

export type NotifyStatusTuple = readonly [number, number, bigint];

export type ActivityItem = {
  id: string;
  title: string;
  description: string;
  timestampLabel: string;
  level: "info" | "success" | "warning";
};

export type SettlementRow = {
  id: string;
  date: string;
  streamId: string;
  recipient: string;
  token: string;
  amount: string;
  status: "SUCCESS" | "RETRYING" | "FAILED";
  insight: string;
};

export type ApiSafeConfig = {
  chainId: number | null;
  rpcUrl: string;
  polkaStream: string;
  usageSettlementHub: string;
  settlementWindowSeconds: number;
  auth?: {
    requireAuth: boolean;
    allowApiKey: boolean;
    allowJwt: boolean;
    allowLegacyToken: boolean;
  };
  rateLimit?: {
    globalPerMin: number;
    tenantPerMin: number;
  };
  circuit?: {
    errorThreshold: number;
    windowSeconds: number;
    cooldownSeconds: number;
  };
  allowlist?: {
    enforce: boolean;
    kinds: string[];
  };
};

export type SettlementMetricsSnapshot = {
  requestEvents: number;
  batchedWindows: number;
  txReductionPct: number;
  avgAggregationLatencySeconds: number;
  throughputRequestsPerBatchTx: number;
};

export type SettlementAuditItem = {
  payer: string;
  provider: string;
  token: string;
  amountWei: string;
  requestCount: number;
};

export type SettlementAuditWindow = {
  windowId: string;
  windowStart: number;
  windowEnd: number;
  totalAmountWei: string;
  totalRequests: number;
  items: SettlementAuditItem[];
};

export type SettlementServiceState = {
  apiBaseUrl: string;
  apiReachable: boolean;
  apiError: string;
  config: ApiSafeConfig | null;
  metrics: SettlementMetricsSnapshot | null;
  metricsError: string;
  windows: SettlementAuditWindow[];
  windowsError: string;
  hubAddress: Address | null;
  token: Address | null;
  tokenAllowed: boolean | null;
  payerEscrow: bigint | null;
  providerClaimable: bigint | null;
  hubReadError: string;
  authProvided: boolean;
  isLoading: boolean;
  lastSyncedAt: string | null;
};
