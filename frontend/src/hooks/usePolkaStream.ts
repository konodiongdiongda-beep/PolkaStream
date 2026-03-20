import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatUnits,
  isAddress,
  maxUint256,
  parseUnits,
  type Address,
  type WalletClient,
} from "viem";

import type {
  ActionType,
  ActivityItem,
  CreateMode,
  NotifyFailureItem,
  NotifyStatusTuple,
  PreflightState,
  PresetToken,
  SettlementRow,
  ServicePlanPreview,
  StreamCardData,
  StreamLifecycleStatus,
  TokenMeta,
  TriggerPolicyName,
  WalletType,
} from "../types";
import { useI18n } from "../i18n";
import {
  POLKASTREAM_ADDRESS,
  SERVICE_PLAN_REGISTRY_ADDRESS,
  connectInjectedWallet,
  erc20Abi,
  explorerTxUrl,
  isWalletInstalled,
  polkaStreamAbi,
  polkadotHubTestnet,
  publicClient,
  servicePlanRegistryAbi,
} from "../lib/viem";

type RawStream = {
  sender: Address;
  receiver: Address;
  deposit: bigint;
  withdrawnAmount: bigint;
  durationInSeconds: bigint;
  startTime: bigint;
  cliffEndsAt: bigint;
  canceledAt: bigint;
  pausedAt: bigint;
  totalPausedDuration: bigint;
  isPaused: boolean;
  isCanceled: boolean;
};

type CommercialStateTuple = readonly [
  number | bigint,
  number | bigint,
  bigint,
  bigint,
  bigint,
  Address,
  `0x${string}`,
  boolean,
  boolean,
];

type PlanBindingTuple = readonly [bigint, `0x${string}`];

type ServicePlanTuple = readonly [
  Address,
  Address,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  number | bigint,
  Address,
  `0x${string}`,
  boolean,
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const NOTIFY_STATUS_FAILED = 3;

const COMMERCIAL_STATUS_PENDING = 1;
const COMMERCIAL_STATUS_ACTIVE = 2;
const COMMERCIAL_STATUS_PAUSED = 3;
const COMMERCIAL_STATUS_COMPLETED = 4;
const COMMERCIAL_STATUS_CANCELED = 5;
const COMMERCIAL_STATUS_EXPIRED = 6;
const TRIGGER_POLICY_NAMES: Record<number, TriggerPolicyName> = {
  0: "NONE",
  1: "SENDER_ONLY",
  2: "RECEIVER_ONLY",
  3: "EITHER_PARTY",
  4: "BOTH_PARTIES",
  5: "AUTHORIZED_OPERATOR",
};

const TRIGGER_POLICY_LABELS: Record<Exclude<TriggerPolicyName, "NONE">, string> = {
  SENDER_ONLY: "Sender only",
  RECEIVER_ONLY: "Receiver only",
  EITHER_PARTY: "Either party",
  BOTH_PARTIES: "Both parties",
  AUTHORIZED_OPERATOR: "Authorized operator",
};

const COMMERCIAL_MODE_LABELS: Record<CreateMode, string> = {
  immediate: "Immediate stream",
  pending: "Pending stream",
  plan: "Fund from ServicePlan",
};

const normalizeSmallInt = (value: number | bigint): number =>
  typeof value === "bigint" ? Number(value) : value;

const formatTriggerPolicyName = (value: number | bigint): TriggerPolicyName =>
  TRIGGER_POLICY_NAMES[normalizeSmallInt(value)] ?? "NONE";

const deriveLegacyStreamStatus = (stream: RawStream): StreamLifecycleStatus => {
  if (stream.isCanceled) return "canceled";
  if (stream.isPaused) return "paused";
  if (stream.deposit > 0n && stream.withdrawnAmount >= stream.deposit) return "completed";
  return "active";
};

const mapCommercialStatus = (
  rawStatus: number | bigint,
  fallback: StreamLifecycleStatus
): StreamLifecycleStatus => {
  switch (normalizeSmallInt(rawStatus)) {
    case COMMERCIAL_STATUS_PENDING:
      return "pending";
    case COMMERCIAL_STATUS_ACTIVE:
      return "active";
    case COMMERCIAL_STATUS_PAUSED:
      return "paused";
    case COMMERCIAL_STATUS_COMPLETED:
      return "completed";
    case COMMERCIAL_STATUS_CANCELED:
      return "canceled";
    case COMMERCIAL_STATUS_EXPIRED:
      return "expired";
    default:
      return fallback;
  }
};

const isActiveLikeStatus = (status: StreamLifecycleStatus): boolean =>
  status === "active" || status === "completed";

const parsePresetTokens = (raw: string | undefined): PresetToken[] => {
  if (!raw) return [];

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      const [symbol, address] = entry.split(":").map((v) => v.trim());
      if (!symbol || !address || !isAddress(address)) return null;
      return { symbol, address: address as Address };
    })
    .filter((item): item is PresetToken => item !== null);
};

const resolveUserErrorMessage = (
  t: (key: string, vars?: Record<string, string | number>) => string,
  error: unknown,
  fallbackKey: string
): string => {
  if (!(error instanceof Error)) return t(fallbackKey);
  const raw = error.message;

  if (raw.startsWith("WALLET_NOT_FOUND:")) {
    const walletType = raw.split(":")[1] as WalletType;
    return t("error.walletNotFound", { wallet: t(`wallet.name.${walletType}`) });
  }

  if (raw.includes("TOKEN_NOT_ALLOWED")) return t("error.tokenNotAllowed");
  if (raw.includes("DURATION_TOO_LONG")) return t("error.durationTooLong");
  if (raw.includes("DEPOSIT_TOO_LARGE")) return t("error.depositTooLarge");
  if (raw.includes("PLAN_NOT_FOUND")) return t("error.planNotFound");
  if (raw.includes("PLAN_INACTIVE")) return t("error.planInactive");
  if (raw.includes("PLAN_DEPOSIT_OUT_OF_RANGE")) return t("error.planDepositOutOfRange");
  if (raw.includes("PLAN_DURATION_OUT_OF_RANGE")) return t("error.planDurationOutOfRange");
  if (raw.includes("SERVICE_PLAN_REGISTRY_NOT_SET")) return t("error.planRegistryNotConfigured");
  if (raw.includes("ACTIVATION_NOT_ALLOWED")) return t("error.activationNotAllowed");
  if (raw.includes("STREAM_NOT_CONFIRMED")) return t("error.streamNotConfirmed");
  if (raw.includes("ACTIVATION_DEADLINE_PASSED")) return t("error.activationDeadlinePassed");
  if (raw.includes("XCM_NOTIFY_FAILED")) return t("error.xcmNotifyFailed");
  if (raw.includes("NOTHING_TO_WITHDRAW")) return t("error.nothingToWithdraw");
  if (raw.includes("ONLY_RECEIVER")) return t("error.onlyReceiver");
  if (raw.includes("ONLY_SENDER")) return t("error.onlySender");
  if (raw.includes("STREAM_CANCELED")) return t("error.streamCanceled");
  if (raw.includes("STREAM_NOT_FOUND")) return t("error.streamNotFound");
  if (raw.includes("User rejected") || raw.includes("rejected")) return t("error.userRejected");

  return t(fallbackKey);
};

export function shortAddress(address?: string | null): string {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function hashStringToBytes32(value: string): Promise<`0x${string}`> {
  const trimmed = value.trim();
  if (!trimmed) return ZERO_HASH;
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) return trimmed as `0x${string}`;

  const encoded = new TextEncoder().encode(trimmed);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `0x${hex}` as `0x${string}`;
}

export function usePolkaStream() {
  const { t } = useI18n();
  const [isHydrated, setIsHydrated] = useState(false);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [walletName, setWalletName] = useState<string>("");
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isPreflightChecking, setIsPreflightChecking] = useState(false);

  const [notice, setNotice] = useState<string>("");
  const [userError, setUserError] = useState<string>("");

  const [streams, setStreams] = useState<StreamCardData[]>([]);
  const [pendingActions, setPendingActions] = useState<Record<string, ActionType | null>>({});
  const [retryingNotifyKeys, setRetryingNotifyKeys] = useState<Record<string, boolean>>({});
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  const [preflight, setPreflight] = useState<PreflightState>({
    chainOk: false,
    contractOk: false,
    notifierOk: false,
    tokenAllowed: null,
    checkedToken: null,
    reason: t("preflight.reason.connectAndCheck"),
  });

  const [form, setForm] = useState({
    createMode: "pending" as CreateMode,
    receiver: "",
    token: "",
    deposit: "",
    durationSeconds: "2592000",
    cliffSeconds: "0",
    triggerPolicy: "RECEIVER_ONLY" as Exclude<TriggerPolicyName, "NONE">,
    activationWindowSeconds: "3600",
    authorizedActivator: "",
    serviceRef: "",
    planId: "",
  });
  const [servicePlanPreview, setServicePlanPreview] = useState<ServicePlanPreview | null>(null);
  const [servicePlanError, setServicePlanError] = useState<string>("");
  const [isLoadingServicePlan, setIsLoadingServicePlan] = useState(false);

  const tokenMetaCacheRef = useRef<Map<string, TokenMeta>>(new Map());

  const isContractConfigured = POLKASTREAM_ADDRESS.toLowerCase() !== ZERO_ADDRESS;

  const env = import.meta.env as Record<string, string | undefined>;
  const presetTokens = useMemo(
    () => parsePresetTokens(env.NEXT_PUBLIC_TOKEN_PRESETS ?? env.VITE_TOKEN_PRESETS),
    [env.NEXT_PUBLIC_TOKEN_PRESETS, env.VITE_TOKEN_PRESETS]
  );

  const metaMaskInstalled = isHydrated && isWalletInstalled("metamask");
  const subWalletInstalled = isHydrated && isWalletInstalled("subwallet");
  const coinbaseInstalled = isHydrated && isWalletInstalled("coinbase");
  const okxInstalled = isHydrated && isWalletInstalled("okx");
  const rabbyInstalled = isHydrated && isWalletInstalled("rabby");
  const braveInstalled = isHydrated && isWalletInstalled("brave");

  const tokenToCheck = useMemo(() => {
    if (form.createMode === "plan") {
      return servicePlanPreview?.token ?? null;
    }
    return isAddress(form.token) ? (form.token as Address) : null;
  }, [form.createMode, form.token, servicePlanPreview]);

  const reportError = useCallback(
    (context: string, error: unknown, fallbackKey: string) => {
      console.error(`[${context}]`, error);
      setUserError(resolveUserErrorMessage(t, error, fallbackKey));
    },
    [t]
  );

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setNotice("");
    setUserError("");
  }, [t]);

  const readTokenMeta = useCallback(async (tokenAddress: Address): Promise<TokenMeta> => {
    const cacheKey = tokenAddress.toLowerCase();
    const cache = tokenMetaCacheRef.current.get(cacheKey);
    if (cache) return cache;

    let decimals = 18;
    let symbol = "TOKEN";

    try {
      const readDecimals = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "decimals",
      });
      decimals = Number(readDecimals);
    } catch {
      decimals = 18;
    }

    try {
      const readSymbol = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "symbol",
      });
      symbol = readSymbol;
    } catch {
      symbol = `${tokenAddress.slice(0, 6)}...`;
    }

    const meta = { symbol, decimals };
    tokenMetaCacheRef.current.set(cacheKey, meta);
    return meta;
  }, []);

  const resolveServicePlanRegistry = useCallback(async (): Promise<Address> => {
    if (SERVICE_PLAN_REGISTRY_ADDRESS.toLowerCase() !== ZERO_ADDRESS) {
      return SERVICE_PLAN_REGISTRY_ADDRESS;
    }

    const registry = (await publicClient.readContract({
      address: POLKASTREAM_ADDRESS,
      abi: polkaStreamAbi,
      functionName: "servicePlanRegistry",
    })) as Address;

    if (!registry || registry.toLowerCase() === ZERO_ADDRESS) {
      throw new Error("SERVICE_PLAN_REGISTRY_NOT_SET");
    }

    return registry;
  }, []);

  const loadServicePlan = useCallback(
    async (planIdRaw: string) => {
      const trimmed = planIdRaw.trim();
      if (!trimmed) {
        setServicePlanPreview(null);
        setServicePlanError("");
        return;
      }

      if (!/^\d+$/.test(trimmed)) {
        setServicePlanPreview(null);
        setServicePlanError(
          t("error.invalidPlanId")
        );
        return;
      }

      setIsLoadingServicePlan(true);
      setServicePlanError("");

      try {
        const registry = await resolveServicePlanRegistry();
        const planId = BigInt(trimmed);
        const plan = (await publicClient.readContract({
          address: registry,
          abi: servicePlanRegistryAbi,
          functionName: "getPlan",
          args: [planId],
        })) as ServicePlanTuple;

        const [provider, token, minDeposit, maxDeposit, minDuration, maxDuration, cliffInSeconds, activationWindow, triggerPolicy, authorizedActivator, termsHash, isActive] =
          plan;
        const tokenMeta = await readTokenMeta(token);

        setServicePlanPreview({
          registry,
          planId,
          provider,
          token,
          tokenSymbol: tokenMeta.symbol,
          tokenDecimals: tokenMeta.decimals,
          minDeposit,
          maxDeposit,
          minDuration,
          maxDuration,
          cliffInSeconds,
          activationWindow,
          triggerPolicyCode: normalizeSmallInt(triggerPolicy),
          triggerPolicyName: formatTriggerPolicyName(triggerPolicy),
          authorizedActivator,
          termsHash,
          isActive,
        });
      } catch (error) {
        console.error("[loadServicePlan]", error);
        setServicePlanPreview(null);
        setServicePlanError(resolveUserErrorMessage(t, error, "error.loadPlanFailed"));
      } finally {
        setIsLoadingServicePlan(false);
      }
    },
    [readTokenMeta, resolveServicePlanRegistry, t]
  );

  useEffect(() => {
    if (form.createMode !== "plan") {
      setServicePlanPreview(null);
      setServicePlanError("");
      setIsLoadingServicePlan(false);
      return;
    }

    void loadServicePlan(form.planId);
  }, [form.createMode, form.planId, loadServicePlan]);

  const runPreflightChecks = useCallback(
    async (tokenAddress: Address | null = null) => {
      const contractOk = isContractConfigured;

      if (!walletClient || !account) {
        setPreflight({
          chainOk: false,
          contractOk,
          notifierOk: false,
          tokenAllowed: null,
          checkedToken: tokenAddress,
          reason: t("preflight.reason.connectWallet"),
        });
        return false;
      }

      setIsPreflightChecking(true);

      try {
        const chainId = await walletClient.getChainId();
        setWalletChainId(chainId);

        if (chainId !== polkadotHubTestnet.id) {
          setPreflight({
            chainOk: false,
            contractOk,
            notifierOk: false,
            tokenAllowed: null,
            checkedToken: tokenAddress,
            reason: t("preflight.reason.switchNetwork", { id: polkadotHubTestnet.id }),
          });
          return false;
        }

        if (!contractOk) {
          setPreflight({
            chainOk: true,
            contractOk: false,
            notifierOk: false,
            tokenAllowed: null,
            checkedToken: tokenAddress,
            reason: t("preflight.reason.configureContract"),
          });
          return false;
        }

        const notifierHealthy = (await publicClient.readContract({
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          functionName: "isNotifierHealthy",
        })) as boolean;

        let tokenAllowed: boolean | null = null;
        if (tokenAddress) {
          tokenAllowed = (await publicClient.readContract({
            address: POLKASTREAM_ADDRESS,
            abi: polkaStreamAbi,
            functionName: "tokenAllowlist",
            args: [tokenAddress],
          })) as boolean;

          if (!tokenAllowed) {
            setPreflight({
              chainOk: true,
              contractOk: true,
              notifierOk: true,
              tokenAllowed: false,
              checkedToken: tokenAddress,
              reason: t("preflight.reason.tokenNotAllowed"),
            });
            return false;
          }
        }

        setPreflight({
          chainOk: true,
          contractOk: true,
          notifierOk: notifierHealthy,
          tokenAllowed,
          checkedToken: tokenAddress,
          reason: notifierHealthy ? t("preflight.reason.ok") : t("preflight.reason.notifierUnhealthy"),
        });
        return true;
      } catch (error) {
        reportError("preflight", error, "error.preflightFailed");
        setPreflight({
          chainOk: false,
          contractOk,
          notifierOk: false,
          tokenAllowed: null,
          checkedToken: tokenAddress,
          reason: t("error.preflightFailed"),
        });
        return false;
      } finally {
        setIsPreflightChecking(false);
      }
    },
    [walletClient, account, isContractConfigured, reportError, t]
  );

  useEffect(() => {
    void runPreflightChecks(tokenToCheck);
  }, [runPreflightChecks, tokenToCheck]);

  const hydrateStreamsForIds = useCallback(
    async (ids: bigint[]): Promise<StreamCardData[]> => {
      if (!account || !isContractConfigured) return [];

      const nextStreams = await Promise.all(
        ids.map(async (streamId) => {
          const [token, streamRaw] = (await publicClient.readContract({
            address: POLKASTREAM_ADDRESS,
            abi: polkaStreamAbi,
            functionName: "getStream",
            args: [streamId],
          })) as [Address, RawStream];

          let status = deriveLegacyStreamStatus(streamRaw);
          let createdAt = 0n;
          let activatedAt = 0n;
          let activationDeadline = 0n;
          let triggerPolicyCode = 0;
          let triggerPolicyName: TriggerPolicyName = "NONE";
          let authorizedActivator = ZERO_ADDRESS as Address;
          let serviceRef = ZERO_HASH as `0x${string}`;
          let senderConfirmed = false;
          let receiverConfirmed = false;

          try {
            const commercialState = (await publicClient.readContract({
              address: POLKASTREAM_ADDRESS,
              abi: polkaStreamAbi,
              functionName: "getStreamCommercialState",
              args: [streamId],
            })) as CommercialStateTuple;

            const [
              commercialStatus,
              triggerPolicy,
              rawCreatedAt,
              rawActivatedAt,
              rawActivationDeadline,
              rawAuthorizedActivator,
              rawServiceRef,
              rawSenderConfirmed,
              rawReceiverConfirmed,
            ] = commercialState;

            status = mapCommercialStatus(commercialStatus, status);
            createdAt = rawCreatedAt;
            activatedAt = rawActivatedAt;
            activationDeadline = rawActivationDeadline;
            triggerPolicyCode = normalizeSmallInt(triggerPolicy);
            triggerPolicyName = formatTriggerPolicyName(triggerPolicy);
            authorizedActivator = rawAuthorizedActivator;
            serviceRef = rawServiceRef;
            senderConfirmed = rawSenderConfirmed;
            receiverConfirmed = rawReceiverConfirmed;
          } catch {
            status = deriveLegacyStreamStatus(streamRaw);
          }

          let planId = 0n;
          let planTermsHash = ZERO_HASH as `0x${string}`;
          try {
            const [rawPlanId, rawPlanTermsHash] = (await publicClient.readContract({
              address: POLKASTREAM_ADDRESS,
              abi: polkaStreamAbi,
              functionName: "getStreamPlanBinding",
              args: [streamId],
            })) as PlanBindingTuple;
            planId = rawPlanId;
            planTermsHash = rawPlanTermsHash;
          } catch {
            planId = 0n;
            planTermsHash = ZERO_HASH as `0x${string}`;
          }

          const owed = (await publicClient.readContract({
            address: POLKASTREAM_ADDRESS,
            abi: polkaStreamAbi,
            functionName: "getOwed",
            args: [streamId],
          })) as bigint;

          const withdrawIds = (await publicClient.readContract({
            address: POLKASTREAM_ADDRESS,
            abi: polkaStreamAbi,
            functionName: "getStreamWithdrawIds",
            args: [streamId],
          })) as bigint[];

          const recentWithdrawIds = withdrawIds.slice(Math.max(0, withdrawIds.length - 16));
          const notifyRows = await Promise.all(
            recentWithdrawIds.map(async (withdrawId) => {
              const [status, attempts, lastAttemptAt] = (await publicClient.readContract({
                address: POLKASTREAM_ADDRESS,
                abi: polkaStreamAbi,
                functionName: "getNotifyStatus",
                args: [withdrawId],
              })) as NotifyStatusTuple;

              return { withdrawId, status, attempts, lastAttemptAt };
            })
          );

          const failedNotifies: NotifyFailureItem[] = notifyRows
            .filter((item) => item.status === NOTIFY_STATUS_FAILED)
            .sort((a, b) => (a.lastAttemptAt > b.lastAttemptAt ? -1 : 1))
            .map((item) => ({
              withdrawId: item.withdrawId,
              attempts: item.attempts,
              lastAttemptAt: item.lastAttemptAt,
            }));

          const tokenMeta = await readTokenMeta(token);
          const role = streamRaw.sender.toLowerCase() === account.toLowerCase() ? "sender" : "receiver";

          return {
            streamId,
            token,
            tokenSymbol: tokenMeta.symbol,
            tokenDecimals: tokenMeta.decimals,
            sender: streamRaw.sender,
            receiver: streamRaw.receiver,
            deposit: streamRaw.deposit,
            withdrawnAmount: streamRaw.withdrawnAmount,
            durationInSeconds: streamRaw.durationInSeconds,
            startTime: streamRaw.startTime,
            cliffEndsAt: streamRaw.cliffEndsAt,
            canceledAt: streamRaw.canceledAt,
            createdAt,
            activatedAt,
            activationDeadline,
            status,
            triggerPolicyCode,
            triggerPolicyName,
            authorizedActivator,
            serviceRef,
            senderConfirmed,
            receiverConfirmed,
            planId,
            planTermsHash,
            isPaused: streamRaw.isPaused,
            isCanceled: streamRaw.isCanceled,
            owed,
            role,
            failedNotifies,
          } satisfies StreamCardData;
        })
      );

      return nextStreams.sort((a, b) => (a.streamId > b.streamId ? -1 : 1));
    },
    [account, isContractConfigured, readTokenMeta]
  );

  const loadRecentActivities = useCallback(async () => {
    if (!account || !isContractConfigured) {
      setRecentActivities([]);
      return;
    }

    try {
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > 250n ? latestBlock - 250n : 0n;

      const [createdEvents, withdrawnEvents, pausedEvents, canceledEvents] = await Promise.all([
        publicClient.getContractEvents({
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          eventName: "StreamCreated",
          fromBlock,
          toBlock: latestBlock,
        }),
        publicClient.getContractEvents({
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          eventName: "Withdrawn",
          fromBlock,
          toBlock: latestBlock,
        }),
        publicClient.getContractEvents({
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          eventName: "StreamPaused",
          fromBlock,
          toBlock: latestBlock,
        }),
        publicClient.getContractEvents({
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          eventName: "StreamCanceled",
          fromBlock,
          toBlock: latestBlock,
        }),
      ]);

      const lower = account.toLowerCase();
      const items: ActivityItem[] = [];

      for (const event of createdEvents.slice(-8)) {
        if (
          event.args.sender?.toLowerCase() === lower ||
          event.args.receiver?.toLowerCase() === lower
        ) {
          items.push({
            id: `created-${event.transactionHash}-${event.logIndex}`,
            title: t("activity.streamCreated.title"),
            description: t("activity.streamCreated.desc", {
              id: event.args.streamId?.toString() ?? "-",
            }),
            timestampLabel: t("activity.blockLabel", {
              block: event.blockNumber?.toString() ?? "-",
            }),
            level: "info",
          });
        }
      }

      for (const event of withdrawnEvents.slice(-8)) {
        items.push({
          id: `withdrawn-${event.transactionHash}-${event.logIndex}`,
          title: t("activity.streamWithdrawn.title"),
          description: t("activity.streamWithdrawn.desc", {
            id: event.args.streamId?.toString() ?? "-",
          }),
          timestampLabel: t("activity.blockLabel", {
            block: event.blockNumber?.toString() ?? "-",
          }),
          level: "success",
        });
      }

      for (const event of pausedEvents.slice(-6)) {
        items.push({
          id: `paused-${event.transactionHash}-${event.logIndex}`,
          title: t("activity.streamPaused.title"),
          description: t("activity.streamPaused.desc", {
            id: event.args.streamId?.toString() ?? "-",
          }),
          timestampLabel: t("activity.blockLabel", {
            block: event.blockNumber?.toString() ?? "-",
          }),
          level: "warning",
        });
      }

      for (const event of canceledEvents.slice(-6)) {
        items.push({
          id: `canceled-${event.transactionHash}-${event.logIndex}`,
          title: t("activity.streamCanceled.title"),
          description: t("activity.streamCanceled.desc", {
            id: event.args.streamId?.toString() ?? "-",
          }),
          timestampLabel: t("activity.blockLabel", {
            block: event.blockNumber?.toString() ?? "-",
          }),
          level: "warning",
        });
      }

      setRecentActivities(items.slice(-12).reverse());
    } catch (error) {
      console.error("[loadRecentActivities]", error);
    }
  }, [account, isContractConfigured, t]);

  const refreshStreams = useCallback(async () => {
    if (!account || !isContractConfigured) {
      setStreams([]);
      return;
    }

    setIsRefreshing(true);

    try {
      const [senderStreamIds, receiverStreamIds] = await Promise.all([
        publicClient.readContract({
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          functionName: "getSenderStreams",
          args: [account],
        }),
        publicClient.readContract({
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          functionName: "getReceiverStreams",
          args: [account],
        }),
      ]);

      const mergedIds = Array.from(
        new Set([...senderStreamIds.map((id) => id.toString()), ...receiverStreamIds.map((id) => id.toString())])
      ).map((id) => BigInt(id));

      const nextStreams = await hydrateStreamsForIds(mergedIds);
      setStreams(nextStreams);

      await loadRecentActivities();
    } catch (error) {
      reportError("refreshStreams", error, "error.refreshFailed");
    } finally {
      setIsRefreshing(false);
    }
  }, [account, isContractConfigured, hydrateStreamsForIds, loadRecentActivities, reportError]);

  useEffect(() => {
    if (!account || !isContractConfigured) {
      setStreams([]);
      return;
    }

    void refreshStreams();
  }, [account, isContractConfigured, refreshStreams]);

  useEffect(() => {
    if (!account || !isContractConfigured) return;

    const timer = window.setInterval(() => {
      void refreshStreams();
    }, 12000);

    return () => window.clearInterval(timer);
  }, [account, isContractConfigured, refreshStreams]);

  useEffect(() => {
    if (!walletClient || !account) return;

    const timer = window.setInterval(() => {
      void runPreflightChecks(tokenToCheck);
    }, 20000);

    return () => window.clearInterval(timer);
  }, [walletClient, account, tokenToCheck, runPreflightChecks]);

  const connectWallet = useCallback(
    async (walletType: WalletType) => {
      setUserError("");
      setNotice("");
      setIsConnecting(true);

      try {
        const { account: nextAccount, walletClient: nextClient, providerName } =
          await connectInjectedWallet(walletType);

        const chainId = await nextClient.getChainId();
        setWalletClient(nextClient);
        setAccount(nextAccount);
        setWalletName(providerName);
        setWalletChainId(chainId);
        setNotice(
          t("notice.connected", { wallet: providerName, address: shortAddress(nextAccount) })
        );
      } catch (error) {
        reportError("connectWallet", error, "error.connectWalletFailed");
      } finally {
        setIsConnecting(false);
      }
    },
    [reportError, t]
  );

  const setStreamActionState = (streamId: bigint, action: ActionType | null) => {
    setPendingActions((prev) => ({
      ...prev,
      [streamId.toString()]: action,
    }));
  };

  const setRetryNotifyState = (streamId: bigint, withdrawId: bigint, value: boolean) => {
    const key = `${streamId.toString()}-${withdrawId.toString()}`;
    setRetryingNotifyKeys((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const sendStreamTx = useCallback(
    async (
      streamId: bigint,
      action: ActionType,
      functionName:
        | "withdraw"
        | "pauseStream"
        | "resumeStream"
        | "cancelStream"
        | "activateStream"
        | "cancelBeforeActivation"
        | "confirmReadyBySender"
        | "confirmReadyByReceiver"
    ) => {
      if (!walletClient || !account) {
        setUserError(t("error.notConnected"));
        return;
      }

      const preflightOk = await runPreflightChecks(null);
      if (!preflightOk) {
        setUserError(t("error.preflightNotOk"));
        return;
      }

      setUserError("");
      setNotice("");
      setStreamActionState(streamId, action);

      try {
        const hash = await walletClient.writeContract({
          chain: undefined,
          account,
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          functionName,
          args: [streamId],
        });

        await publicClient.waitForTransactionReceipt({ hash });
        setNotice(
          t("notice.txConfirmed", { hash: hash.slice(0, 10), url: explorerTxUrl(hash) })
        );
        await refreshStreams();
      } catch (error) {
        reportError("sendStreamTx", error, "error.txFailed");
      } finally {
        setStreamActionState(streamId, null);
      }
    },
    [walletClient, account, runPreflightChecks, refreshStreams, reportError, t]
  );

  const retryNotifyTx = useCallback(
    async (streamId: bigint, withdrawId: bigint) => {
      if (!walletClient || !account) {
        setUserError(t("error.notConnected"));
        return;
      }

      const preflightOk = await runPreflightChecks(null);
      if (!preflightOk) {
        setUserError(t("error.preflightNotOk"));
        return;
      }

      setUserError("");
      setNotice("");
      setRetryNotifyState(streamId, withdrawId, true);

      try {
        const hash = await walletClient.writeContract({
          chain: undefined,
          account,
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          functionName: "retryNotify",
          args: [streamId, withdrawId],
        });

        await publicClient.waitForTransactionReceipt({ hash });
        setNotice(
          t("notice.retryConfirmed", { hash: hash.slice(0, 10), url: explorerTxUrl(hash) })
        );
        await refreshStreams();
      } catch (error) {
        reportError("retryNotify", error, "error.retryNotifyFailed");
      } finally {
        setRetryNotifyState(streamId, withdrawId, false);
      }
    },
    [walletClient, account, runPreflightChecks, refreshStreams, reportError, t]
  );

  const createStream = useCallback(async () => {
    if (!walletClient || !account) {
      setUserError(t("error.notConnected"));
      return;
    }

    const duration = Number(form.durationSeconds);
    const cliff = Number(form.cliffSeconds);
    const tokenAddress = form.createMode === "plan" ? servicePlanPreview?.token ?? null : isAddress(form.token) ? (form.token as Address) : null;

    if (form.createMode !== "plan") {
      if (!isAddress(form.receiver)) {
        setUserError(t("error.invalidReceiver"));
        return;
      }

      if (!tokenAddress) {
        setUserError(t("error.invalidToken"));
        return;
      }

      if (!Number.isFinite(duration) || duration <= 0) {
        setUserError(t("error.invalidDuration"));
        return;
      }

      if (!Number.isFinite(cliff) || cliff < 0) {
        setUserError(t("error.invalidCliff"));
        return;
      }
    }

    if (!form.deposit || Number(form.deposit) <= 0) {
      setUserError(t("error.invalidDeposit"));
      return;
    }

    if (
      form.createMode === "pending" &&
      form.triggerPolicy === "AUTHORIZED_OPERATOR" &&
      !isAddress(form.authorizedActivator)
    ) {
      setUserError(t("error.invalidAuthorizedActivator"));
      return;
    }

    if (form.createMode === "plan") {
      if (!servicePlanPreview) {
        setUserError(servicePlanError || t("error.planNotLoaded"));
        return;
      }
      if (!form.planId.trim()) {
        setUserError(t("error.invalidPlanId"));
        return;
      }
      if (!Number.isFinite(duration) || duration <= 0) {
        setUserError(t("error.invalidDuration"));
        return;
      }
    }

    const preflightOk = await runPreflightChecks(tokenAddress);
    if (!preflightOk) {
      setUserError(t("error.preflightCreateBlocked"));
      return;
    }

    setIsCreating(true);
    setUserError("");
    setNotice("");

    try {
      if (!tokenAddress) {
        throw new Error("TOKEN_NOT_RESOLVED");
      }

      const decimals =
        form.createMode === "plan" && servicePlanPreview
          ? servicePlanPreview.tokenDecimals
          : Number(
              await publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "decimals",
              })
            );
      const depositAmount = parseUnits(form.deposit, decimals);
      const allowance = (await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, POLKASTREAM_ADDRESS],
      })) as bigint;

      if (allowance < depositAmount) {
        const approveHash = await walletClient.writeContract({
          chain: undefined,
          account,
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [POLKASTREAM_ADDRESS, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const serviceRef = await hashStringToBytes32(form.serviceRef);
      let createHash: `0x${string}`;

      if (form.createMode === "immediate") {
        createHash = await walletClient.writeContract({
          chain: undefined,
          account,
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          functionName: "createStream",
          args: [form.receiver as Address, depositAmount, BigInt(duration), BigInt(cliff), tokenAddress],
        });
      } else if (form.createMode === "pending") {
        const activationWindowSeconds = Number(form.activationWindowSeconds || "0");
        const activationDeadline =
          Number.isFinite(activationWindowSeconds) && activationWindowSeconds > 0
            ? BigInt(Math.floor(Date.now() / 1000) + activationWindowSeconds)
            : 0n;
        const triggerPolicyMap: Record<Exclude<TriggerPolicyName, "NONE">, number> = {
          SENDER_ONLY: 1,
          RECEIVER_ONLY: 2,
          EITHER_PARTY: 3,
          BOTH_PARTIES: 4,
          AUTHORIZED_OPERATOR: 5,
        };
        const triggerPolicyCode = triggerPolicyMap[form.triggerPolicy];
        const authorizedActivator =
          triggerPolicyCode === 5 && isAddress(form.authorizedActivator)
            ? (form.authorizedActivator as Address)
            : (ZERO_ADDRESS as Address);

        createHash = await walletClient.writeContract({
          chain: undefined,
          account,
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          functionName: "createPendingStream",
          args: [
            form.receiver as Address,
            depositAmount,
            BigInt(duration),
            BigInt(cliff),
            tokenAddress,
            activationDeadline,
            triggerPolicyCode,
            authorizedActivator,
            serviceRef,
          ],
        });
      } else {
        createHash = await walletClient.writeContract({
          chain: undefined,
          account,
          address: POLKASTREAM_ADDRESS,
          abi: polkaStreamAbi,
          functionName: "createPendingStreamFromPlan",
          args: [BigInt(form.planId), depositAmount, BigInt(duration), serviceRef],
        });
      }

      await publicClient.waitForTransactionReceipt({ hash: createHash });
      setNotice(
        t(form.createMode === "immediate" ? "notice.streamCreated" : "notice.pendingStreamCreated", {
          hash: createHash.slice(0, 10),
          url: explorerTxUrl(createHash),
        })
      );
      setForm((prev) => ({
        ...prev,
        deposit: "",
        serviceRef: "",
        ...(prev.createMode === "plan" ? {} : { authorizedActivator: "" }),
      }));
      await refreshStreams();
    } catch (error) {
      reportError("createStream", error, "error.createStreamFailed");
    } finally {
      setIsCreating(false);
    }
  }, [
    walletClient,
    account,
    form,
    runPreflightChecks,
    refreshStreams,
    reportError,
    servicePlanPreview,
    servicePlanError,
    t,
  ]);

  const doWithdraw = useCallback(
    async (streamId: bigint) => sendStreamTx(streamId, "withdraw", "withdraw"),
    [sendStreamTx]
  );

  const doPause = useCallback(
    async (streamId: bigint) => sendStreamTx(streamId, "pause", "pauseStream"),
    [sendStreamTx]
  );

  const doResume = useCallback(
    async (streamId: bigint) => sendStreamTx(streamId, "resume", "resumeStream"),
    [sendStreamTx]
  );

  const doCancel = useCallback(
    async (streamId: bigint) => sendStreamTx(streamId, "cancel", "cancelStream"),
    [sendStreamTx]
  );

  const doActivate = useCallback(
    async (streamId: bigint) => sendStreamTx(streamId, "activate", "activateStream"),
    [sendStreamTx]
  );

  const doCancelPending = useCallback(
    async (streamId: bigint) => sendStreamTx(streamId, "cancelPending", "cancelBeforeActivation"),
    [sendStreamTx]
  );

  const doConfirmSender = useCallback(
    async (streamId: bigint) => sendStreamTx(streamId, "confirmSender", "confirmReadyBySender"),
    [sendStreamTx]
  );

  const doConfirmReceiver = useCallback(
    async (streamId: bigint) => sendStreamTx(streamId, "confirmReceiver", "confirmReadyByReceiver"),
    [sendStreamTx]
  );

  const dashboardStats = useMemo(() => {
    const activeCount = streams.filter((item) => isActiveLikeStatus(item.status)).length;
    const pausedCount = streams.filter((item) => item.status === "paused").length;
    const canceledCount = streams.filter((item) => item.status === "canceled" || item.status === "expired").length;
    const failedNotifyCount = streams.reduce((acc, item) => acc + item.failedNotifies.length, 0);

    const totalOwed = streams
      .filter((item) => item.role === "receiver")
      .reduce((acc, item) => acc + Number.parseFloat(formatUnits(item.owed, item.tokenDecimals)), 0);

    return {
      activeCount,
      pausedCount,
      canceledCount,
      failedNotifyCount,
      totalOwed: Number(totalOwed.toFixed(4)),
    };
  }, [streams]);

  const settlements = useMemo<SettlementRow[]>(() => {
    return streams.slice(0, 30).map((stream) => {
      const amount = Number.parseFloat(formatUnits(stream.withdrawnAmount, stream.tokenDecimals)).toFixed(4);
      const hasFailedNotify = stream.failedNotifies.length > 0;

      return {
        id: stream.streamId.toString(),
        date: stream.startTime > 0n ? new Date(Number(stream.startTime) * 1000).toLocaleDateString() : "-",
        streamId: stream.streamId.toString(),
        recipient: shortAddress(stream.receiver),
        token: stream.tokenSymbol,
        amount,
        status: hasFailedNotify ? "RETRYING" : stream.isCanceled ? "SUCCESS" : "SUCCESS",
        insight: hasFailedNotify
          ? t("settlements.insight.failedNotify", { count: stream.failedNotifies.length })
          : t("settlements.insight.normal"),
      };
    });
  }, [streams, t]);

  const globalTxDisabled = !preflight.chainOk || !preflight.contractOk;
  const createBlockedByToken =
    tokenToCheck !== null &&
    preflight.checkedToken?.toLowerCase() === tokenToCheck.toLowerCase() &&
    preflight.tokenAllowed === false;
  const createBlockedByPlan =
    form.createMode === "plan" &&
    (isLoadingServicePlan || !servicePlanPreview || Boolean(servicePlanError));

  const createDisabled = isCreating || globalTxDisabled || createBlockedByToken || createBlockedByPlan;
  const createDisabledReason = createBlockedByPlan
    ? servicePlanError || (isLoadingServicePlan ? t("create.loadingPlan") : t("error.planNotLoaded"))
    : createBlockedByToken
      ? t("error.tokenNotAllowedShort")
      : preflight.reason;

  return {
    state: {
      account,
      walletName,
      walletChainId,
      isHydrated,
      isContractConfigured,
      isConnecting,
      isRefreshing,
      isCreating,
      isPreflightChecking,
      notice,
      userError,
      streams,
      pendingActions,
      retryingNotifyKeys,
      preflight,
      form,
      servicePlanPreview,
      servicePlanError,
      isLoadingServicePlan,
      tokenToCheck,
      presetTokens,
      walletAvailability: {
        metamask: metaMaskInstalled,
        subwallet: subWalletInstalled,
        coinbase: coinbaseInstalled,
        okx: okxInstalled,
        rabby: rabbyInstalled,
        brave: braveInstalled,
      },
      dashboardStats,
      recentActivities,
      settlements,
      globalTxDisabled,
      createDisabled,
      createDisabledReason,
    },
    actions: {
      setForm,
      connectWallet,
      runPreflightChecks,
      refreshStreams,
      createStream,
      doWithdraw,
      doPause,
      doResume,
      doCancel,
      doActivate,
      doCancelPending,
      doConfirmSender,
      doConfirmReceiver,
      retryNotifyTx,
      setUserError,
      setNotice,
    },
  };
}
