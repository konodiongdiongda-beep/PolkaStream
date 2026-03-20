import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Building2,
  ChevronDown,
  CircleAlert,
  Github,
  Handshake,
  Languages,
  Loader2,
  Mail,
  Store,
  User,
  Wallet,
  X,
  Youtube,
} from "lucide-react";
import { formatUnits, isAddress, type Address } from "viem";

import { usePolkaStream, shortAddress } from "./hooks/usePolkaStream";
import { useSettlementSurface } from "./hooks/useSettlementSurface";
import { useI18n, type Language } from "./i18n";
import type {
  ActionType,
  CreateMode,
  NotifyFailureItem,
  PreflightState,
  PresetToken,
  SettlementServiceState,
  ServicePlanPreview,
  StreamCardData,
  TriggerPolicyName,
  WalletType,
} from "./types";

const resolveAdminAllowlist = (): Set<string> => {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = env.NEXT_PUBLIC_ADMIN_ALLOWLIST ?? env.VITE_ADMIN_ALLOWLIST ?? "";
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => isAddress(item))
      .map((item) => item.toLowerCase())
  );
};

const ADMIN_ALLOWLIST = resolveAdminAllowlist();

type SettlementTokenOption = {
  address: Address;
  symbol: string;
};

type WalletOption = {
  id: WalletType;
  label: string;
  installed: boolean;
};

type ViewMode = "home" | "console";
type SheetMode = "create" | null;
type CreateFormState = ReturnType<typeof usePolkaStream>["state"]["form"];
type CreateFormSetter = Dispatch<SetStateAction<CreateFormState>>;

type AppCopy = {
  homeEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroSupport: string;
  heroBody: string;
  heroFootnote: string;
  createButton: string;
  consoleButton: string;
  overviewLabel: string;
  overviewTitle: string;
  overviewBody: string;
  overviewTags: [string, string, string];
  overviewNotes: Array<{ label: string; body: string }>;
  scenarioEyebrow: string;
  scenarioTitle: string;
  scenarioBody: string;
  scenarioCta: string;
  scenarioMeta: string;
  footerLead: string;
  consoleEyebrow: string;
  consoleTitle: string;
  consoleBody: string;
  consoleBack: string;
  consoleStreamTitle: string;
  consoleStreamBody: string;
  consoleSettlementTitle: string;
  consoleSettlementBody: string;
  consoleWalletTitle: string;
  consoleActivityTitle: string;
  pendingYoutube: string;
};

type PersonaAction = "create" | "console" | "agentScenario" | "skillGuide";

type PersonaRole = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  steps: string[];
  ctaLabel: string;
  action: PersonaAction;
};

type PersonaGroup = {
  id: "consumer" | "producer";
  title: string;
  summary: string;
  roles: PersonaRole[];
};

const PRODUCT_LINKS = {
  github: "https://github.com/konodiongdiongda-beep/PolkaStream",
  youtube: "https://www.youtube.com/",
  email: "mailto:bu.dong@iwhalecloud.com",
  agentScenario: "https://polkastream-console.vercel.app",
  agentSkillGuide: "https://github.com/konodiongdiongda-beep/PolkaStream/blob/main/docs/ARCH_AI_SETTLEMENT.md",
} as const;

const SURFACE_LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "zh-CN", label: "简中" },
  { value: "en", label: "EN" },
];

const APP_COPY: Record<Language, AppCopy> = {
  "zh-CN": {
    homeEyebrow: "稳定币流支付",
    heroTitle: "PolkaStream",
    heroSubtitle: "Polkadot Hub 上的稳定币流支付",
    heroSupport: "AI Agent Settlement 是当前重点应用场景。",
    heroBody:
      "PolkaStream 的核心功能是稳定币流支付。连接钱包后，填写接收方、代币、金额和持续时间，即可发起一条真实的链上流支付；随后可在控制台查看使用情况、当前余额与失败通知重试。",
    heroFootnote: "当前演示运行在 Polkadot Hub 测试网。",
    createButton: "创建流支付",
    consoleButton: "控制台",
    overviewLabel: "项目说明",
    overviewTitle: "为持续性数字服务打造的稳定币流支付协议",
    overviewBody:
      "PolkaStream 是部署在 Polkadot Hub 上的安全稳定币流支付协议。我们提供稳健的核心控制能力，支持资金按秒精确释放，涵盖完整的流控制（withdraw / pause / resume / cancel）、多 Token 支持以及失败通知的补偿重试。目前，AI Agent 结算是我们将灵活的链上流支付付诸实践的最强场景之一，向您展示流支付如何完美赋能持续性的智能服务。",
    overviewTags: ["stream payments", "retry notify", "Polkadot Hub Testnet"],
    overviewNotes: [
      {
        label: "协议核心能力",
        body: "提供完整的稳定币流支付基础能力，涵盖建流、资金提取、全周期状态控制及高级的失败通知补偿机制。",
      },
      {
        label: "以 AI 为骨的旗舰场景",
        body: "利用 Agent 服务天然高频的计费特性，完美演绎持续性的流支付与批量结算相互协同配合的最佳实践。",
      },
      {
        label: "真实链上演练环境",
        body: "核心协议已稳定部署在此 Polkadot Hub 测试网中，带来全透明、可追溯且基于真实钱包鉴权的上链操作体验。",
      },
    ],
    scenarioEyebrow: "旗舰应用场景",
    scenarioTitle: "AI Agent Settlement",
    scenarioBody: "如果你要给 Agent / AI 服务做按时长或按用量收款，这个场景已经整理成单独入口，可直接打开线上版本。",
    scenarioCta: "打开 Agent 场景",
    scenarioMeta: "线上入口",
    footerLead: "更多链接",
    consoleEyebrow: "控制台",
    consoleTitle: "流支付与 AI 结算",
    consoleBody: "这里集中查看流支付、AI 用量结算、余额状态与失败通知重试。",
    consoleBack: "返回首页",
    consoleStreamTitle: "每一条流的使用情况",
    consoleStreamBody: "重点看当前余额、可领取金额、Withdraw 和 Retry Notify。",
    consoleSettlementTitle: "AI 结算状态",
    consoleSettlementBody: "按代币查看当前托管余额、可领取余额和 24 小时结算指标。",
    consoleWalletTitle: "钱包与网络状态",
    consoleActivityTitle: "最近活动",
    pendingYoutube: "YouTube（待上传）",
  },
  "zh-TW": {
    homeEyebrow: "穩定幣流支付",
    heroTitle: "PolkaStream",
    heroSubtitle: "Polkadot Hub 上的穩定幣流支付",
    heroSupport: "AI Agent Settlement 是目前重點應用場景。",
    heroBody:
      "PolkaStream 的核心功能是穩定幣流支付。連接錢包後，填寫接收方、代幣、金額與持續時間，即可發起一條真實的鏈上流支付；之後可在控制台查看使用情況、目前餘額與失敗通知重試。",
    heroFootnote: "目前演示運行於 Polkadot Hub 測試網。",
    createButton: "建立流支付",
    consoleButton: "控制台",
    overviewLabel: "專案說明",
    overviewTitle: "為持續性數位服務打造的穩定幣流支付協議",
    overviewBody:
      "PolkaStream 是部署在 Polkadot Hub 上的安全穩定幣流支付協議。我們提供穩健的核心控制能力，支援資金按秒精確釋放，涵蓋完整的流控制（withdraw / pause / resume / cancel）、多 Token 支援以及失敗通知的補償重試。目前，AI Agent 結算是我們將靈活的鏈上流支付付諸實踐的最強場景之一，向您展示流支付如何完美賦能持續性的智能服務。",
    overviewTags: ["stream payments", "retry notify", "Polkadot Hub Testnet"],
    overviewNotes: [
      {
        label: "協議核心能力",
        body: "提供完整的穩定幣流支付基礎能力，涵蓋建流、資金提取、全週期狀態控制及高級的失敗通知補償機制。",
      },
      {
        label: "以 AI 為骨的旗艦場景",
        body: "利用 Agent 服務天然高頻的計費特性，完美演繹持續性的流支付與批量結算相互協同配合的最佳實踐。",
      },
      {
        label: "真實鏈上演練環境",
        body: "核心協議已穩定部署在此 Polkadot Hub 測試網中，帶來全透明、可追溯且基於真實錢包鑑權的上鏈操作體驗。",
      },
    ],
    scenarioEyebrow: "旗艦應用場景",
    scenarioTitle: "AI Agent Settlement",
    scenarioBody: "如果你要為 Agent / AI 服務做按時長或按用量收款，這個場景已整理成單獨入口，可直接打開線上版本。",
    scenarioCta: "打開 Agent 場景",
    scenarioMeta: "線上入口",
    footerLead: "更多連結",
    consoleEyebrow: "控制台",
    consoleTitle: "流支付與 AI 結算",
    consoleBody: "這裡集中查看流支付、AI 用量結算、餘額狀態與失敗通知重試。",
    consoleBack: "返回首頁",
    consoleStreamTitle: "每一條流的使用情況",
    consoleStreamBody: "重點看目前餘額、可領取金額、Withdraw 與 Retry Notify。",
    consoleSettlementTitle: "AI 結算狀態",
    consoleSettlementBody: "按代幣查看目前託管餘額、可領取餘額與 24 小時結算指標。",
    consoleWalletTitle: "錢包與網路狀態",
    consoleActivityTitle: "最近活動",
    pendingYoutube: "YouTube（待上傳）",
  },
  "en": {
    homeEyebrow: "Stablecoin Stream Payments",
    heroTitle: "PolkaStream",
    heroSubtitle: "Stablecoin stream payments on Polkadot Hub",
    heroSupport: "AI Agent Settlement is the flagship scenario.",
    heroBody:
      "PolkaStream is built around stablecoin stream payments. Connect a wallet, set receiver, token, amount, and duration, then create a real onchain stream. After that, move into the console to inspect usage, balances, and retryable notify failures.",
    heroFootnote: "This demo is live on Polkadot Hub Testnet.",
    createButton: "Create Stream",
    consoleButton: "Console",
    overviewLabel: "Overview",
    overviewTitle: "A Stablecoin Streaming Payments Protocol for Continuous Services",
    overviewBody:
      "PolkaStream is a secure stablecoin streaming payments protocol deployed on Polkadot Hub. It provides robust core components including per-second precise release, complete lifecycle control (withdraw / pause / resume / cancel), multi-token capacity, and retryable notify recovery. Currently, AI Agent Settlement serves as our flagship scenario, demonstrating how streaming payments ideally empower continuous intelligent services.",
    overviewTags: ["stream payments", "retry notify", "Polkadot Hub Testnet"],
    overviewNotes: [
      {
        label: "Core capability",
        body: "The product core is stablecoin stream payments with real lifecycle actions and retryable notify handling.",
      },
      {
        label: "Why the Agent scenario",
        body: "Agent and AI services are naturally billed by duration or usage, which makes the stream + settlement story easy to show.",
      },
      {
        label: "Current state",
        body: "This is a Polkadot Hub Testnet demo with live wallet, preflight, and onchain actions.",
      },
    ],
    scenarioEyebrow: "Flagship Scenario",
    scenarioTitle: "AI Agent Settlement",
    scenarioBody: "If you need duration-based or usage-based billing for an agent or AI service, this scenario already has a dedicated live entry point.",
    scenarioCta: "Open Agent Scenario",
    scenarioMeta: "Live entry",
    footerLead: "More links",
    consoleEyebrow: "Console",
    consoleTitle: "Streams and AI Settlement",
    consoleBody: "Inspect streams, AI usage settlement, balances, and retryable notify failures in one surface.",
    consoleBack: "Back Home",
    consoleStreamTitle: "Usage per stream",
    consoleStreamBody: "Focus on balances, claimable amounts, withdraw, and retry notify.",
    consoleSettlementTitle: "AI Settlement",
    consoleSettlementBody: "Inspect escrow, claimable balance, and 24h settlement metrics by token.",
    consoleWalletTitle: "Wallet and Network",
    consoleActivityTitle: "Recent Activity",
    pendingYoutube: "YouTube (Pending)",
  },
  "ja": {
    homeEyebrow: "ステーブルコインのストリーミング決済",
    heroTitle: "PolkaStream",
    heroSubtitle: "Polkadot Hub 上のステーブルコインストリーム決済",
    heroSupport: "AI Agent Settlement is the flagship scenario.",
    heroBody:
      "PolkaStream is built around stablecoin stream payments. Connect a wallet, set receiver, token, amount, and duration, then create a real onchain stream. After that, move into the console to inspect usage, balances, and retryable notify failures.",
    heroFootnote: "This demo is live on Polkadot Hub Testnet.",
    createButton: "Create Stream",
    consoleButton: "Console",
    overviewLabel: "Overview",
    overviewTitle: "A Stablecoin Streaming Payments Protocol for Continuous Services",
    overviewBody:
      "PolkaStream is a secure stablecoin streaming payments protocol deployed on Polkadot Hub. It provides robust core components including per-second precise release, complete lifecycle control (withdraw / pause / resume / cancel), multi-token capacity, and retryable notify recovery. Currently, AI Agent Settlement serves as our flagship scenario, demonstrating how streaming payments ideally empower continuous intelligent services.",
    overviewTags: ["stream payments", "retry notify", "Polkadot Hub Testnet"],
    overviewNotes: [
      {
        label: "Core capability",
        body: "The product core is stablecoin stream payments with real lifecycle actions and retryable notify handling.",
      },
      {
        label: "Why the Agent scenario",
        body: "Agent and AI services are naturally billed by duration or usage, which makes the stream + settlement story easy to show.",
      },
      {
        label: "Current state",
        body: "This is a Polkadot Hub Testnet demo with live wallet, preflight, and onchain actions.",
      },
    ],
    scenarioEyebrow: "Flagship Scenario",
    scenarioTitle: "AI Agent Settlement",
    scenarioBody: "If you need duration-based or usage-based billing for an agent or AI service, this scenario already has a dedicated live entry point.",
    scenarioCta: "Open Agent Scenario",
    scenarioMeta: "Live entry",
    footerLead: "More links",
    consoleEyebrow: "Console",
    consoleTitle: "Streams and AI Settlement",
    consoleBody: "Inspect streams, AI usage settlement, balances, and retryable notify failures in one surface.",
    consoleBack: "Back Home",
    consoleStreamTitle: "Usage per stream",
    consoleStreamBody: "Focus on balances, claimable amounts, withdraw, and retry notify.",
    consoleSettlementTitle: "AI Settlement",
    consoleSettlementBody: "Inspect escrow, claimable balance, and 24h settlement metrics by token.",
    consoleWalletTitle: "Wallet and Network",
    consoleActivityTitle: "Recent Activity",
    pendingYoutube: "YouTube (Pending)",
  },
  "ko": {
    homeEyebrow: "스테이블코인 스트림 결제",
    heroTitle: "PolkaStream",
    heroSubtitle: "Polkadot Hub 기반 스테이블코인 스트림 결제",
    heroSupport: "AI Agent Settlement is the flagship scenario.",
    heroBody:
      "PolkaStream is built around stablecoin stream payments. Connect a wallet, set receiver, token, amount, and duration, then create a real onchain stream. After that, move into the console to inspect usage, balances, and retryable notify failures.",
    heroFootnote: "This demo is live on Polkadot Hub Testnet.",
    createButton: "Create Stream",
    consoleButton: "Console",
    overviewLabel: "Overview",
    overviewTitle: "A Stablecoin Streaming Payments Protocol for Continuous Services",
    overviewBody:
      "PolkaStream is a secure stablecoin streaming payments protocol deployed on Polkadot Hub. It provides robust core components including per-second precise release, complete lifecycle control (withdraw / pause / resume / cancel), multi-token capacity, and retryable notify recovery. Currently, AI Agent Settlement serves as our flagship scenario, demonstrating how streaming payments ideally empower continuous intelligent services.",
    overviewTags: ["stream payments", "retry notify", "Polkadot Hub Testnet"],
    overviewNotes: [
      {
        label: "Core capability",
        body: "The product core is stablecoin stream payments with real lifecycle actions and retryable notify handling.",
      },
      {
        label: "Why the Agent scenario",
        body: "Agent and AI services are naturally billed by duration or usage, which makes the stream + settlement story easy to show.",
      },
      {
        label: "Current state",
        body: "This is a Polkadot Hub Testnet demo with live wallet, preflight, and onchain actions.",
      },
    ],
    scenarioEyebrow: "Flagship Scenario",
    scenarioTitle: "AI Agent Settlement",
    scenarioBody: "If you need duration-based or usage-based billing for an agent or AI service, this scenario already has a dedicated live entry point.",
    scenarioCta: "Open Agent Scenario",
    scenarioMeta: "Live entry",
    footerLead: "More links",
    consoleEyebrow: "Console",
    consoleTitle: "Streams and AI Settlement",
    consoleBody: "Inspect streams, AI usage settlement, balances, and retryable notify failures in one surface.",
    consoleBack: "Back Home",
    consoleStreamTitle: "Usage per stream",
    consoleStreamBody: "Focus on balances, claimable amounts, withdraw, and retry notify.",
    consoleSettlementTitle: "AI Settlement",
    consoleSettlementBody: "Inspect escrow, claimable balance, and 24h settlement metrics by token.",
    consoleWalletTitle: "Wallet and Network",
    consoleActivityTitle: "Recent Activity",
    pendingYoutube: "YouTube (Pending)",
  },
};

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

const formatCreateModeLabel = (mode: CreateMode, language: string) => {
  if (mode === "immediate") {
    return language.startsWith("zh") ? "立即流" : "Immediate";
  }
  if (mode === "pending") {
    return language.startsWith("zh") ? "待激活流" : "Pending";
  }
  return language.startsWith("zh") ? "ServicePlan 注资" : "ServicePlan";
};

const formatCreateModeBody = (mode: CreateMode, language: string) => {
  if (mode === "immediate") {
    return language.startsWith("zh")
      ? "交易确认后立即开始按秒释放，适合已经确认交付时间的连续结算。"
      : "Starts releasing as soon as the transaction is confirmed. Best when service delivery is already agreed.";
  }
  if (mode === "pending") {
    return language.startsWith("zh")
      ? "先锁定预算，不会立刻计费；等触发器满足后再正式开始释放。"
      : "Lock budget first without charging immediately. Release begins only after the trigger condition is satisfied.";
  }
  return language.startsWith("zh")
    ? "由 provider 先定义商业边界，buyer 按计划范围注资，适合正式服务套餐。"
    : "Provider defines the commercial guardrails first, then the buyer funds within the approved plan.";
};

const formatTriggerPolicyLabel = (policy: TriggerPolicyName, language: string) => {
  switch (policy) {
    case "SENDER_ONLY":
      return language.startsWith("zh") ? "仅付款方触发" : "Sender only";
    case "RECEIVER_ONLY":
      return language.startsWith("zh") ? "仅收款方触发" : "Receiver only";
    case "EITHER_PARTY":
      return language.startsWith("zh") ? "任一方触发" : "Either party";
    case "BOTH_PARTIES":
      return language.startsWith("zh") ? "双方确认后触发" : "Both parties";
    case "AUTHORIZED_OPERATOR":
      return language.startsWith("zh") ? "授权操作员触发" : "Authorized operator";
    default:
      return language.startsWith("zh") ? "立即开始" : "Immediate";
  }
};

const formatTimestampLabel = (value: bigint, language: string) => {
  if (value <= 0n) return "--";
  return new Date(Number(value) * 1000).toLocaleString(language, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatServiceRefLabel = (value: `0x${string}`, language: string) => {
  if (!value || value.toLowerCase() === ZERO_HASH) {
    return language.startsWith("zh") ? "未设置" : "Not set";
  }
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
};

const deriveStreamMode = (stream: StreamCardData): CreateMode => {
  if (stream.planId > 0n) return "plan";
  if (stream.triggerPolicyName !== "NONE" || stream.status === "pending" || stream.activationDeadline > 0n) {
    return "pending";
  }
  return "immediate";
};

const resolveInitialView = (): ViewMode => {
  if (typeof window !== "undefined" && window.location.hash === "#console") {
    return "console";
  }
  return "home";
};

const formatDurationLabel = (secondsRaw: string, language: string) => {
  const seconds = Number(secondsRaw);
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";
  if (seconds % 86400 === 0) return `${seconds / 86400}${language.startsWith("zh") ? "天" : "d"}`;
  if (seconds % 3600 === 0) return `${seconds / 3600}${language.startsWith("zh") ? "小时" : "h"}`;
  if (seconds % 60 === 0) return `${seconds / 60}${language.startsWith("zh") ? "分" : "m"}`;
  return `${seconds}${language.startsWith("zh") ? "秒" : "s"}`;
};

const formatStreamAmount = (amount: bigint, decimals: number) =>
  Number.parseFloat(formatUnits(amount, decimals)).toFixed(4);

const formatDisplayNumber = (value: number) => {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  }

  return value.toFixed(4).replace(/\.?0+$/, "");
};

const formatTokenAmount = (amount: bigint | null | undefined, decimals: number, symbol?: string) => {
  if (amount === null || amount === undefined) return "--";
  const value = Number.parseFloat(formatUnits(amount, decimals));
  if (!Number.isFinite(value)) return "--";

  const text = formatDisplayNumber(value);
  return symbol ? `${text} ${symbol}` : text;
};

const formatSyncLabel = (value: string | null, language: string) => {
  if (!value) return "--";
  return new Date(value).toLocaleString(language, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatWindowLabel = (windowStart: number, windowEnd: number, language: string) => {
  const start = new Date(windowStart * 1000);
  const end = new Date(windowEnd * 1000);
  return `${start.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString(
    language,
    { hour: "2-digit", minute: "2-digit" }
  )}`;
};

const getPersonaGroups = (language: Language): PersonaGroup[] => {
  if (language === "zh-TW") {
    return [
      {
        id: "consumer",
        title: "付款方",
        summary: "從預算與付款視角開始，選擇最接近你的使用角色。",
        roles: [
          {
            id: "consumer-human",
            title: "直接付款方",
            summary: "適合團隊採購、訂閱或持續服務付款。",
            detail: "連接錢包後建立一條流支付，先鎖定預算，再透過控制台查看釋放進度、餘額與失敗恢復。",
            steps: ["連接錢包", "建立流支付", "在控制台查看進度與重試"],
            ctaLabel: "立即建立流支付",
            action: "create",
          },
          {
            id: "consumer-agent",
            title: "自動化買方",
            summary: "適合需要自動採購 API、算力或數位服務的 Agent。",
            detail: "當你的系統需要更細緻的自動化預算控制時，可以先以 streaming payments 作為主支付軌，再按需接入 Skill 或結算擴展。",
            steps: ["確認 payer / provider / token", "建立主支付流", "按需接入 Skill 或結算擴展"],
            ctaLabel: "查看 Skill 說明",
            action: "skillGuide",
          },
        ],
      },
      {
        id: "producer",
        title: "收款方",
        summary: "從提供服務與收款視角開始，選擇最接近你的角色。",
        roles: [
          {
            id: "producer-service",
            title: "服務提供方",
            summary: "適合 API、算力、SaaS 或長期數位服務。",
            detail: "如果你持續向客戶提供服務，最適合在控制台查看每條流的餘額、可領取金額、狀態變化與失敗恢復。",
            steps: ["打開控制台", "查看每條流的可領取餘額", "提款或處理失敗通知"],
            ctaLabel: "打開控制台",
            action: "console",
          },
          {
            id: "producer-personal",
            title: "獨立收款方",
            summary: "適合自由工作者、創作者或一對一合作。",
            detail: "如果你是個人收款方，可以先建立一條示例流支付，再用控制台展示餘額、提款與狀態變化。",
            steps: ["建立示例流支付", "展示餘額與收款狀態", "在控制台查看提款與通知"],
            ctaLabel: "建立示例流支付",
            action: "create",
          },
          {
            id: "producer-agent",
            title: "Agent 服務方",
            summary: "當 Agent 本身對外提供能力並持續收款。",
            detail: "如果 Agent 本身就是服務提供者，可以在 streaming core 基礎上接入 Skill 或 AI 結算擴展，再查看 provider claim 與結算狀態。",
            steps: ["配置 Agent / Skill", "接入 AI 結算擴展", "查看 provider claim 與結算狀態"],
            ctaLabel: "查看 Skill 說明",
            action: "skillGuide",
          },
        ],
      },
    ];
  }

  if (language.startsWith("zh")) {
    return [
      {
        id: "consumer",
        title: "付款方",
        summary: "从预算与付款视角开始，选择最接近你的使用角色。",
        roles: [
          {
            id: "consumer-human",
            title: "直接付款方",
            summary: "适合团队采购、订阅或持续服务付款。",
            detail: "连接钱包后创建一条流支付，先锁定预算，再通过控制台查看释放进度、余额与失败恢复。",
            steps: ["连接钱包", "创建流支付", "在控制台查看进度与重试"],
            ctaLabel: "立即创建流支付",
            action: "create",
          },
          {
            id: "consumer-agent",
            title: "自动化买方",
            summary: "适合需要自动采购 API、算力或数字服务的 Agent。",
            detail: "当你的系统需要更细粒度的自动化预算控制时，可以先以 streaming payments 作为主支付轨，再按需接入 Skill 或结算扩展。",
            steps: ["确认 payer / provider / token", "建立主支付流", "按需接入 Skill 或结算扩展"],
            ctaLabel: "查看 Skill 说明",
            action: "skillGuide",
          },
        ],
      },
      {
        id: "producer",
        title: "收款方",
        summary: "从提供服务与收款视角开始，选择最接近你的角色。",
        roles: [
          {
            id: "producer-service",
            title: "服务提供方",
            summary: "适合 API、算力、SaaS 或长期数字服务。",
            detail: "如果你持续向客户提供服务，最适合在控制台查看每条流的余额、可领取金额、状态变化与失败恢复。",
            steps: ["打开控制台", "查看每条流的可领取余额", "提款或处理失败通知"],
            ctaLabel: "打开控制台",
            action: "console",
          },
          {
            id: "producer-personal",
            title: "独立收款方",
            summary: "适合自由职业者、创作者或一对一合作。",
            detail: "如果你是个人收款方，可以先创建一条示例流支付，再用控制台展示余额、提款和状态变化。",
            steps: ["创建示例流支付", "展示余额与收款状态", "在控制台查看提款与通知"],
            ctaLabel: "创建示例流支付",
            action: "create",
          },
          {
            id: "producer-agent",
            title: "Agent 服务方",
            summary: "当 Agent 本身对外提供能力并持续收款。",
            detail: "如果 Agent 本身就是服务提供者，可以在 streaming core 基础上接入 Skill 或 AI 结算扩展，再查看 provider claim 与结算状态。",
            steps: ["配置 Agent / Skill", "接入 AI 结算扩展", "查看 provider claim 与结算状态"],
            ctaLabel: "查看 Skill 说明",
            action: "skillGuide",
          },
        ],
      },
    ];
  }

  return [
    {
      id: "consumer",
      title: "Payer Side",
      summary: "Start from the budget and payment side, then choose the role closest to your workflow.",
      roles: [
        {
          id: "consumer-human",
          title: "Direct payer",
          summary: "Best for team procurement, subscriptions, or ongoing service payments.",
          detail: "Connect a wallet, create a stream, lock budget once, then use the console to monitor release progress, balances, and failure recovery.",
          steps: ["Connect wallet", "Create stream", "Review progress and retry flow in Console"],
          ctaLabel: "Create Stream",
          action: "create",
        },
        {
          id: "consumer-agent",
          title: "Automated buyer",
          summary: "Best for agents that procure APIs, compute, or digital services.",
          detail: "When your system needs tighter automated budget control, use streaming payments as the primary payment rail and attach skill or settlement extensions only when needed.",
          steps: ["Confirm payer / provider / token", "Create the main payment stream", "Attach skill or settlement extensions if needed"],
          ctaLabel: "Open Skill Guide",
          action: "skillGuide",
        },
      ],
    },
    {
      id: "producer",
      title: "Provider Side",
      summary: "Start from the service and receivable side, then choose the role closest to your business.",
      roles: [
        {
          id: "producer-service",
          title: "Service provider",
          summary: "Best for API, compute, SaaS, or ongoing digital services.",
          detail: "If you provide services continuously, the console is the best place to inspect stream balances, claimable amounts, state changes, and failure recovery.",
          steps: ["Open Console", "Inspect claimable balance on each stream", "Withdraw or handle retry notify"],
          ctaLabel: "Open Console",
          action: "console",
        },
        {
          id: "producer-personal",
          title: "Independent receiver",
          summary: "Best for freelancers, creators, or one-to-one collaboration.",
          detail: "If you receive as an individual, create a sample stream first, then use the console to show balances, withdraw flow, and state changes.",
          steps: ["Create a sample stream", "Show balance and receivable state", "Review withdraw and notify status in Console"],
          ctaLabel: "Create Sample Stream",
          action: "create",
        },
        {
          id: "producer-agent",
          title: "Agent provider",
          summary: "When the agent itself provides paid capabilities.",
          detail: "If the agent is the service provider, you can start from the streaming core and then attach skill or AI settlement extensions to inspect provider claimability.",
          steps: ["Configure the agent or skill", "Attach the AI settlement extension", "Inspect provider claim and settlement state"],
          ctaLabel: "Open Skill Guide",
          action: "skillGuide",
        },
      ],
    },
  ];
};

const getStreamUsageMetrics = (stream: StreamCardData) => {
  const usedAmount = stream.withdrawnAmount + stream.owed;
  const remainingAmount = stream.deposit > usedAmount ? stream.deposit - usedAmount : 0n;
  const progressPct =
    stream.deposit > 0n ? Math.min(100, Number((usedAmount * 10000n) / stream.deposit) / 100) : 0;

  return {
    usedAmount,
    remainingAmount,
    progressPct,
  };
};

export default function App() {
  const { t, language, setLanguage } = useI18n();
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<SheetMode>(null);
  const [currentView, setCurrentView] = useState<ViewMode>(() => resolveInitialView());
  const [selectedSettlementToken, setSelectedSettlementToken] = useState<Address | null>(null);
  const { state, actions } = usePolkaStream();

  useEffect(() => {
    const syncFromUrl = () => {
      setCurrentView(resolveInitialView());
    };

    window.addEventListener("hashchange", syncFromUrl);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener("hashchange", syncFromUrl);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  useEffect(() => {
    setWalletMenuOpen(false);
  }, [currentView]);

  const settlementTokenOptions = useMemo<SettlementTokenOption[]>(() => {
    const map = new Map<string, SettlementTokenOption>();

    for (const preset of state.presetTokens) {
      map.set(preset.address.toLowerCase(), {
        address: preset.address,
        symbol: preset.symbol,
      });
    }

    for (const stream of state.streams) {
      map.set(stream.token.toLowerCase(), {
        address: stream.token,
        symbol: stream.tokenSymbol,
      });
    }

    return Array.from(map.values());
  }, [state.presetTokens, state.streams]);

  useEffect(() => {
    if (
      selectedSettlementToken &&
      settlementTokenOptions.some((item) => item.address.toLowerCase() === selectedSettlementToken.toLowerCase())
    ) {
      return;
    }

    setSelectedSettlementToken(settlementTokenOptions[0]?.address ?? null);
  }, [selectedSettlementToken, settlementTokenOptions]);

  const selectedSettlementTokenOption = useMemo(
    () =>
      settlementTokenOptions.find(
        (item) => item.address.toLowerCase() === selectedSettlementToken?.toLowerCase()
      ) ?? null,
    [selectedSettlementToken, settlementTokenOptions]
  );

  const { state: settlementState } = useSettlementSurface({
    account: state.account,
    token: selectedSettlementToken,
  });

  const isAdmin = useMemo(() => {
    if (!state.account) return false;
    return ADMIN_ALLOWLIST.has(state.account.toLowerCase());
  }, [state.account]);

  const walletOptions: WalletOption[] = [
    { id: "metamask", label: t("wallet.name.metamask"), installed: state.walletAvailability.metamask },
    { id: "subwallet", label: t("wallet.name.subwallet"), installed: state.walletAvailability.subwallet },
    { id: "coinbase", label: t("wallet.name.coinbase"), installed: state.walletAvailability.coinbase },
    { id: "okx", label: t("wallet.name.okx"), installed: state.walletAvailability.okx },
    { id: "rabby", label: t("wallet.name.rabby"), installed: state.walletAvailability.rabby },
    { id: "brave", label: t("wallet.name.brave"), installed: state.walletAvailability.brave },
  ];

  const installedWalletOptions = walletOptions.filter((item) => item.installed);
  const preferredWallet = installedWalletOptions[0] ?? null;

  const walletButtonLabel = state.isConnecting
    ? language.startsWith("zh")
      ? "连接中..."
      : "Connecting..."
    : state.account
      ? shortAddress(state.account)
      : t("wallet.connect");
  const preflightReadyCount = [
    state.preflight.chainOk,
    state.preflight.contractOk,
    state.preflight.notifierOk,
    state.preflight.tokenAllowed === true,
  ].filter(Boolean).length;

  const selectedSettlementTokenDecimals = useMemo(() => {
    if (!selectedSettlementToken) return 18;
    return (
      state.streams.find((item) => item.token.toLowerCase() === selectedSettlementToken.toLowerCase())
        ?.tokenDecimals ?? 18
    );
  }, [selectedSettlementToken, state.streams]);

  const showConsoleIndicator = state.streams.length > 0 || state.dashboardStats.failedNotifyCount > 0;

  const handleWalletButtonClick = () => {
    if (!state.isHydrated || state.isConnecting) return;

    if (!state.account && installedWalletOptions.length === 1 && preferredWallet) {
      void actions.connectWallet(preferredWallet.id);
      return;
    }

    setWalletMenuOpen((open) => !open);
  };

  const openCreateSheet = () => {
    setWalletMenuOpen(false);
    setActiveSheet("create");
  };

  const navigateView = (next: ViewMode) => {
    const url = new URL(window.location.href);
    url.hash = next === "console" ? "console" : "";
    window.history.pushState({}, "", url);
    setCurrentView(next);
    setWalletMenuOpen(false);
  };

  const copy = useMemo(() => APP_COPY[language] ?? APP_COPY.en, [language]);

  return (
    <div className="app-shell min-h-screen text-[#101113]">
      {currentView === "home" ? (
        <HomeView
          copy={copy}
          language={language}
          setLanguage={setLanguage}
          walletButtonLabel={walletButtonLabel}
          walletMenuOpen={walletMenuOpen}
          installedWalletOptions={installedWalletOptions}
          preferredWallet={preferredWallet}
          state={state}
          t={t}
          handleWalletButtonClick={handleWalletButtonClick}
          setWalletMenuOpen={setWalletMenuOpen}
          connectWallet={actions.connectWallet}
          preflightReadyCount={preflightReadyCount}
          apiReachable={settlementState.apiReachable}
          onOpenConsole={() => navigateView("console")}
          onOpenCreate={openCreateSheet}
          showConsoleIndicator={showConsoleIndicator}
        />
      ) : (
        <ConsoleView
          copy={copy}
          language={language}
          setLanguage={setLanguage}
          t={t}
          walletButtonLabel={walletButtonLabel}
          walletMenuOpen={walletMenuOpen}
          installedWalletOptions={installedWalletOptions}
          preferredWallet={preferredWallet}
          state={state}
          settlementState={settlementState}
          selectedSettlementToken={selectedSettlementToken}
          selectedSettlementTokenOption={selectedSettlementTokenOption}
          selectedSettlementTokenDecimals={selectedSettlementTokenDecimals}
          tokenOptions={settlementTokenOptions}
          isAdmin={isAdmin}
          handleWalletButtonClick={handleWalletButtonClick}
          setWalletMenuOpen={setWalletMenuOpen}
          connectWallet={actions.connectWallet}
          preflightReadyCount={preflightReadyCount}
          onSelectToken={(value) => setSelectedSettlementToken(value)}
          onBackHome={() => navigateView("home")}
          onOpenCreate={openCreateSheet}
          onWithdraw={actions.doWithdraw}
          onPause={actions.doPause}
          onResume={actions.doResume}
          onCancel={actions.doCancel}
          onActivate={actions.doActivate}
          onCancelPending={actions.doCancelPending}
          onConfirmSender={actions.doConfirmSender}
          onConfirmReceiver={actions.doConfirmReceiver}
          onRetryNotify={actions.retryNotifyTx}
        />
      )}

      <CreateSheet
        open={activeSheet === "create"}
        onClose={() => setActiveSheet(null)}
        language={language}
        notice={state.notice}
        userError={state.userError}
        account={state.account}
        form={state.form}
        setForm={actions.setForm}
        servicePlanPreview={state.servicePlanPreview}
        servicePlanError={state.servicePlanError}
        isLoadingServicePlan={state.isLoadingServicePlan}
        presetTokens={state.presetTokens}
        preflight={state.preflight}
        isPreflightChecking={state.isPreflightChecking}
        createDisabled={state.createDisabled}
        createDisabledReason={state.createDisabledReason}
        isCreating={state.isCreating}
        onCreate={actions.createStream}
      />
    </div>
  );
}

function HomeView({
  copy,
  language,
  setLanguage,
  walletButtonLabel,
  walletMenuOpen,
  installedWalletOptions,
  preferredWallet,
  state,
  t,
  handleWalletButtonClick,
  setWalletMenuOpen,
  connectWallet,
  preflightReadyCount,
  apiReachable,
  onOpenConsole,
  onOpenCreate,
  showConsoleIndicator,
}: {
  copy: AppCopy;
  language: Language;
  setLanguage: (lang: Language) => void;
  walletButtonLabel: string;
  walletMenuOpen: boolean;
  installedWalletOptions: WalletOption[];
  preferredWallet: WalletOption | null;
  state: ReturnType<typeof usePolkaStream>["state"];
  t: (key: string, vars?: Record<string, string | number>) => string;
  handleWalletButtonClick: () => void;
  setWalletMenuOpen: Dispatch<SetStateAction<boolean>>;
  connectWallet: (walletType: WalletType) => Promise<void>;
  preflightReadyCount: number;
  apiReachable: boolean;
  onOpenConsole: () => void;
  onOpenCreate: () => void;
  showConsoleIndicator: boolean;
}) {
  const personaGroups = useMemo(() => getPersonaGroups(language), [language]);

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <section className="relative overflow-hidden rounded-[34px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,247,251,0.98)_0%,rgba(255,252,253,0.98)_42%,rgba(255,255,255,0.98)_100%)] px-5 py-5 shadow-[0_28px_88px_rgba(16,17,19,0.08)] sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,227,239,0.78)_0%,rgba(255,237,244,0.52)_20%,rgba(255,248,252,0.18)_42%,rgba(255,255,255,0)_78%),radial-gradient(circle_at_top_left,rgba(255,92,164,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,205,226,0.9),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-28 h-36 bg-[linear-gradient(180deg,rgba(255,242,248,0.34),rgba(255,255,255,0))] blur-3xl" />

        <header className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <BrandBlock
            title="PolkaStream"
            subtitle={copy.homeEyebrow}
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <LanguageSwitcher language={language} onChange={setLanguage} />

            <WalletMenu
              language={language}
              t={t}
              walletButtonLabel={walletButtonLabel}
              walletMenuOpen={walletMenuOpen}
              installedWalletOptions={installedWalletOptions}
              preferredWallet={preferredWallet}
              state={state}
              handleWalletButtonClick={handleWalletButtonClick}
              setWalletMenuOpen={setWalletMenuOpen}
              connectWallet={connectWallet}
            />

            <button
              onClick={onOpenConsole}
              className="fx-rainbow-dark relative inline-flex h-10 items-center rounded-full border border-black/10 bg-[#101113] px-4 text-sm font-medium text-white shadow-[0_10px_25px_rgba(16,17,19,0.12)] transition hover:bg-black"
            >
              {copy.consoleButton}
              {showConsoleIndicator ? (
                <span className="absolute -right-1 -top-1 inline-flex size-4 items-center justify-center rounded-full bg-[#ff5ca4] text-[10px] font-semibold text-white">
                  !
                </span>
              ) : null}
            </button>
          </div>
        </header>

        <div className="relative z-10 flex min-h-[540px] flex-col items-center justify-center pb-8 pt-12 text-center sm:min-h-[620px] sm:pb-10 sm:pt-16 lg:min-h-[640px] lg:pb-14">
          <div className="flex flex-wrap justify-center gap-2">
            <HeroBadge label={t("dashboard.badgeTestnet")} tone="lime" />
            <HeroBadge
              label={apiReachable ? t("app.apiUp") : t("app.apiOffline")}
              tone={apiReachable ? "pink" : "muted"}
            />
            <HeroBadge
              label={t("dashboard.preflightReady", { ready: preflightReadyCount, total: 4 })}
              tone={preflightReadyCount === 4 ? "pink" : "muted"}
            />
          </div>

          <h1 className="mt-8 font-display text-[2.95rem] font-semibold tracking-[-0.09em] text-black sm:text-[4.8rem] lg:text-[5.4rem]">
            {copy.heroTitle}
          </h1>
          <p className="mt-4 text-[1rem] font-semibold text-black/88 sm:text-[1.25rem]">{copy.heroSubtitle}</p>
          <p className="mt-2 text-[1rem] text-black/72 sm:text-[1.1rem]">{copy.heroSupport}</p>
          <p className="mt-5 max-w-[720px] text-[15px] leading-8 text-black/62 sm:text-[15.5px]">{copy.heroBody}</p>

          <div className="mt-9 flex justify-center">
            <button
              onClick={onOpenCreate}
              className="fx-rainbow-pink inline-flex items-center gap-3 rounded-full border border-[#ff5ca4]/18 bg-[#ff5ca4] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_20px_45px_rgba(255,92,164,0.26)] transition hover:translate-y-[-1px] hover:bg-[#ff4d9a] sm:px-7 sm:py-3.5"
            >
              <span>{copy.createButton}</span>
              <ArrowUpRight className="size-4" />
            </button>
          </div>

          <p className="mt-4 text-sm leading-7 text-black/48">{copy.heroFootnote}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <article className="rounded-[30px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,248,252,0.92))] p-6 shadow-[0_20px_55px_rgba(16,17,19,0.05)] sm:p-7">
          <p className="text-[12px] font-semibold tracking-[0.16em] text-black/38">{copy.overviewLabel}</p>
          <h2 className="mt-3 font-display text-[1.65rem] font-semibold tracking-[-0.05em] text-black sm:text-[2rem]">
            {copy.overviewTitle}
          </h2>
          <p className="mt-4 max-w-[760px] text-[15px] leading-8 text-black/62">{copy.overviewBody}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {copy.overviewTags.map((tag) => (
              <HeroBadge key={tag} label={tag} tone="muted" />
            ))}
          </div>

          <PersonaSurface
            language={language}
            groups={personaGroups}
            onOpenCreate={onOpenCreate}
            onOpenConsole={onOpenConsole}
          />
        </article>

        <article className="rounded-[30px] border border-black/8 bg-white/88 p-5 shadow-[0_16px_40px_rgba(16,17,19,0.04)] sm:p-6">
          <div className="space-y-4">
            {copy.overviewNotes.map((item, index) => (
              <div
                key={item.label}
                className={`${index === 0 ? "" : "border-t border-black/6 pt-4"}`}
              >
                <p className="text-[12px] font-semibold tracking-[0.14em] text-black/38">{item.label}</p>
                <p className="mt-2 text-sm leading-7 text-black/60">{item.body}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-black/8 bg-white/78 px-5 py-4 text-sm shadow-[0_16px_40px_rgba(16,17,19,0.04)]">
        <p className="text-black/48">{copy.footerLead}</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <FooterIconLink href={PRODUCT_LINKS.github} label="GitHub" icon={<Github className="size-4" />} />
          <FooterIconLink href={PRODUCT_LINKS.youtube} label={copy.pendingYoutube} icon={<Youtube className="size-4" />} />
          <FooterIconLink href={PRODUCT_LINKS.email} label="Email" icon={<Mail className="size-4" />} />
        </div>
      </footer>
    </main>
  );
}

function ConsoleView({
  copy,
  language,
  setLanguage,
  t,
  walletButtonLabel,
  walletMenuOpen,
  installedWalletOptions,
  preferredWallet,
  state,
  settlementState,
  selectedSettlementToken,
  selectedSettlementTokenOption,
  selectedSettlementTokenDecimals,
  tokenOptions,
  isAdmin,
  handleWalletButtonClick,
  setWalletMenuOpen,
  connectWallet,
  preflightReadyCount,
  onSelectToken,
  onBackHome,
  onOpenCreate,
  onWithdraw,
  onPause,
  onResume,
  onCancel,
  onActivate,
  onCancelPending,
  onConfirmSender,
  onConfirmReceiver,
  onRetryNotify,
}: {
  copy: AppCopy;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  walletButtonLabel: string;
  walletMenuOpen: boolean;
  installedWalletOptions: WalletOption[];
  preferredWallet: WalletOption | null;
  state: ReturnType<typeof usePolkaStream>["state"];
  settlementState: SettlementServiceState;
  selectedSettlementToken: Address | null;
  selectedSettlementTokenOption: SettlementTokenOption | null;
  selectedSettlementTokenDecimals: number;
  tokenOptions: SettlementTokenOption[];
  isAdmin: boolean;
  handleWalletButtonClick: () => void;
  setWalletMenuOpen: Dispatch<SetStateAction<boolean>>;
  connectWallet: (walletType: WalletType) => Promise<void>;
  preflightReadyCount: number;
  onSelectToken: (value: Address) => void;
  onBackHome: () => void;
  onOpenCreate: () => void;
  onWithdraw: (streamId: bigint) => Promise<void>;
  onPause: (streamId: bigint) => Promise<void>;
  onResume: (streamId: bigint) => Promise<void>;
  onCancel: (streamId: bigint) => Promise<void>;
  onActivate: (streamId: bigint) => Promise<void>;
  onCancelPending: (streamId: bigint) => Promise<void>;
  onConfirmSender: (streamId: bigint) => Promise<void>;
  onConfirmReceiver: (streamId: bigint) => Promise<void>;
  onRetryNotify: (streamId: bigint, withdrawId: bigint) => Promise<void>;
}) {
  const authRequired = settlementState.config?.auth?.requireAuth;
  const authStatus =
    authRequired === undefined
      ? "--"
      : authRequired
        ? settlementState.authProvided
          ? t("common.requiredTokenProvided")
          : t("common.requiredTokenMissing")
        : t("common.public");
  const settlementAlerts = Array.from(
    new Set(
      settlementState.apiReachable
        ? [settlementState.apiError, settlementState.metricsError, settlementState.windowsError, settlementState.hubReadError].filter(
            (item): item is string => Boolean(item)
          )
        : [
            language.startsWith("zh")
              ? "结算服务当前离线，右侧结算数据暂时不可用；你仍然可以继续演示钱包连接、创建流支付和链上状态。"
              : "The settlement service is currently offline. You can still demo wallet connection, stream creation, and onchain state.",
          ]
    )
  );

  const metricCards = [
    {
      label: language.startsWith("zh") ? "当前可领取" : "Claimable",
      value: formatTokenAmount(
        settlementState.providerClaimable,
        selectedSettlementTokenDecimals,
        selectedSettlementTokenOption?.symbol ?? t("common.token")
      ),
      detail: language.startsWith("zh") ? "UsageSettlementHub 当前可领取余额" : "Current provider claimable balance",
    },
    {
      label: language.startsWith("zh") ? "当前托管余额" : "Escrow",
      value: formatTokenAmount(
        settlementState.payerEscrow,
        selectedSettlementTokenDecimals,
        selectedSettlementTokenOption?.symbol ?? t("common.token")
      ),
      detail: language.startsWith("zh") ? "付款方在结算 Hub 中的托管余额" : "Payer escrow held in the settlement hub",
    },
    {
      label: language.startsWith("zh") ? "活跃流" : "Active Streams",
      value: state.dashboardStats.activeCount,
      detail: language.startsWith("zh") ? "当前仍在执行中的流支付" : "Streams currently active or completed",
    },
    {
      label: language.startsWith("zh") ? "待重试通知" : "Retry Queue",
      value: state.dashboardStats.failedNotifyCount,
      detail: language.startsWith("zh") ? "失败通知仍需重试的条目" : "Failed notify records that still need action",
    },
  ];

  return (
    <main className="mx-auto max-w-[1320px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <section className="relative overflow-hidden rounded-[34px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,247,251,0.98)_0%,rgba(255,252,253,0.98)_48%,rgba(255,255,255,0.98)_100%)] px-5 py-5 shadow-[0_28px_88px_rgba(16,17,19,0.08)] sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,226,238,0.72)_0%,rgba(255,239,246,0.34)_26%,rgba(255,255,255,0)_72%),radial-gradient(circle_at_top_left,rgba(255,92,164,0.15),transparent_30%),radial-gradient(circle_at_top_right,rgba(255,214,232,0.9),transparent_34%)]" />

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-[680px]">
              <button
                onClick={onBackHome}
                className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/80 px-3.5 py-2 text-sm font-medium text-black/72 transition hover:border-black/14 hover:bg-white hover:text-black"
              >
                <ArrowLeft className="size-4" />
                {copy.consoleBack}
              </button>

              <div className="mt-5">
                <BrandBlock title="PolkaStream" subtitle={copy.consoleEyebrow} compact />
                <h1 className="mt-4 font-display text-[2.15rem] font-semibold tracking-[-0.07em] text-black sm:text-[2.9rem] lg:text-[3.2rem]">
                  {copy.consoleTitle}
                </h1>
                <p className="mt-3 max-w-[620px] text-[15px] leading-8 text-black/62">{copy.consoleBody}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <HeroBadge label={t("dashboard.badgeTestnet")} tone="lime" />
                <HeroBadge
                  label={settlementState.apiReachable ? t("app.apiUp") : t("app.apiOffline")}
                  tone={settlementState.apiReachable ? "pink" : "muted"}
                />
                <HeroBadge
                  label={t("dashboard.preflightReady", { ready: preflightReadyCount, total: 4 })}
                  tone={preflightReadyCount === 4 ? "pink" : "muted"}
                />
                <HeroBadge
                  label={
                    selectedSettlementTokenOption
                      ? `${language.startsWith("zh") ? "当前代币" : "Token"} ${selectedSettlementTokenOption.symbol}`
                      : t("common.noTokenDetected")
                  }
                  tone="muted"
                />
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
              <LanguageSwitcher language={language} onChange={setLanguage} />

              <WalletMenu
                language={language}
                t={t}
                walletButtonLabel={walletButtonLabel}
                walletMenuOpen={walletMenuOpen}
                installedWalletOptions={installedWalletOptions}
                preferredWallet={preferredWallet}
                state={state}
                handleWalletButtonClick={handleWalletButtonClick}
                setWalletMenuOpen={setWalletMenuOpen}
                connectWallet={connectWallet}
              />

              <button
                onClick={onOpenCreate}
                className="fx-rainbow-pink inline-flex h-10 items-center gap-2 rounded-full border border-[#ff5ca4]/18 bg-[#ff5ca4] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(255,92,164,0.24)] transition hover:bg-[#ff4d9a]"
              >
                <span>{copy.createButton}</span>
                <ArrowUpRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((item) => (
              <MetricCard key={item.label} label={item.label} value={item.value} detail={item.detail} />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1.52fr)_360px]">
        <article className="rounded-[30px] border border-black/8 bg-white/92 p-5 shadow-[0_20px_55px_rgba(16,17,19,0.05)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold tracking-[0.16em] text-black/38">{copy.consoleEyebrow}</p>
              <h2 className="mt-2 font-display text-[1.5rem] font-semibold tracking-[-0.05em] text-black sm:text-[1.8rem]">
                {copy.consoleStreamTitle}
              </h2>
              <p className="mt-3 max-w-[720px] text-sm leading-7 text-black/60">{copy.consoleStreamBody}</p>
            </div>
            {state.globalTxDisabled ? (
              <span className="rounded-full border border-[#ffd0e1] bg-[#fff2f7] px-3 py-1.5 text-[11px] font-medium text-[#b53b78]">
                {state.preflight.reason}
              </span>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {state.streams.length === 0 ? (
              <ConsoleEmptyState
                copy={copy}
                language={language}
                t={t}
                state={state}
                selectedSettlementTokenOption={selectedSettlementTokenOption}
                settlementState={settlementState}
                preflightReadyCount={preflightReadyCount}
                onOpenCreate={onOpenCreate}
                onConnectWallet={handleWalletButtonClick}
              />
            ) : (
              state.streams.map((stream) => (
                <StreamRow
                  key={stream.streamId.toString()}
                  stream={stream}
                  language={language}
                  pendingAction={state.pendingActions[stream.streamId.toString()] ?? null}
                  retryingNotifyKeys={state.retryingNotifyKeys}
                  actionsDisabled={state.globalTxDisabled}
                  disabledReason={state.preflight.reason}
                  onWithdraw={onWithdraw}
                  onPause={onPause}
                  onResume={onResume}
                  onCancel={onCancel}
                  onActivate={onActivate}
                  onCancelPending={onCancelPending}
                  onConfirmSender={onConfirmSender}
                  onConfirmReceiver={onConfirmReceiver}
                  onRetryNotify={onRetryNotify}
                />
              ))
            )}
          </div>
        </article>

        <div className="space-y-4">
          <article className="rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,247,251,0.96),rgba(255,253,254,0.96))] p-5 shadow-[0_16px_40px_rgba(16,17,19,0.04)]">
            <p className="text-[12px] font-semibold tracking-[0.16em] text-black/38">{copy.consoleSettlementTitle}</p>
            <p className="mt-3 text-sm leading-7 text-black/60">{copy.consoleSettlementBody}</p>

            <div className="mt-4">
              <label className="text-[12px] font-medium text-black/48">{t("common.selectedToken")}</label>
              <select
                value={selectedSettlementToken ?? ""}
                onChange={(event) => {
                  if (!event.target.value) return;
                  onSelectToken(event.target.value as Address);
                }}
                className="input-shell mt-2"
              >
                {tokenOptions.length === 0 ? (
                  <option value="">{t("common.noTokenDetected")}</option>
                ) : (
                  tokenOptions.map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <MiniStat label={t("common.token")} value={selectedSettlementTokenOption?.symbol ?? "--"} />
              <MiniStat label={t("common.api")} value={settlementState.apiReachable ? t("common.reachable") : t("common.offline")} />
              <MiniStat label={t("common.auth")} value={authStatus} />
              <MiniStat
                label={language.startsWith("zh") ? "允许状态" : "Allowlist"}
                value={
                  settlementState.tokenAllowed === null
                    ? "--"
                    : settlementState.tokenAllowed
                      ? t("common.allowed")
                      : t("common.blocked")
                }
              />
              <MiniStat
                label={language.startsWith("zh") ? "托管余额" : t("settlements.payerEscrow")}
                value={formatTokenAmount(
                  settlementState.payerEscrow,
                  selectedSettlementTokenDecimals,
                  selectedSettlementTokenOption?.symbol
                )}
              />
              <MiniStat
                label={language.startsWith("zh") ? "可领取余额" : t("settlements.providerClaimable")}
                value={formatTokenAmount(
                  settlementState.providerClaimable,
                  selectedSettlementTokenDecimals,
                  selectedSettlementTokenOption?.symbol
                )}
              />
            </div>

            {settlementState.metrics ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
                <MiniStat
                  label={language.startsWith("zh") ? "24h 使用事件" : "24h request events"}
                  value={formatDisplayNumber(settlementState.metrics.requestEvents)}
                />
                <MiniStat
                  label={language.startsWith("zh") ? "24h 批次窗口" : "24h batched windows"}
                  value={formatDisplayNumber(settlementState.metrics.batchedWindows)}
                />
                <MiniStat
                  label={language.startsWith("zh") ? "压缩率" : "Tx reduction"}
                  value={`${formatDisplayNumber(settlementState.metrics.txReductionPct)}%`}
                />
                <MiniStat
                  label={language.startsWith("zh") ? "平均延迟" : "Avg latency"}
                  value={`${formatDisplayNumber(settlementState.metrics.avgAggregationLatencySeconds)}s`}
                />
              </div>
            ) : null}

            {settlementState.windows.length > 0 ? (
              <div className="mt-4 space-y-2">
                {settlementState.windows.slice(0, 2).map((window) => (
                  <div key={window.windowId} className="rounded-[18px] border border-black/8 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-black">
                        {formatWindowLabel(window.windowStart, window.windowEnd, language)}
                      </p>
                      <span className="text-[11px] text-black/42">
                        {language.startsWith("zh") ? `${window.totalRequests} 次请求` : `${window.totalRequests} requests`}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-black/46">
                      {language.startsWith("zh")
                        ? `${window.items.length} 条结算项`
                        : `${window.items.length} settlement items`}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill label={t("dashboard.badgeTestnet")} ok={true} />
              <StatusPill
                label={settlementState.apiReachable ? t("app.apiUp") : t("app.apiOffline")}
                ok={settlementState.apiReachable}
              />
              <StatusPill
                label={language.startsWith("zh") ? "Hub 已连接" : "Hub connected"}
                ok={Boolean(settlementState.hubAddress)}
              />
            </div>

            {settlementAlerts.map((message) => (
              <Alert key={message} tone="error">
                {message}
              </Alert>
            ))}
          </article>

          <article className="rounded-[28px] border border-black/8 bg-white/92 p-5 shadow-[0_16px_40px_rgba(16,17,19,0.04)]">
            <p className="text-[12px] font-semibold tracking-[0.16em] text-black/38">{copy.consoleWalletTitle}</p>
            <div className="mt-4 grid gap-2">
              <MiniStat label={language.startsWith("zh") ? "当前地址" : t("common.currentAccount")} value={state.account ? shortAddress(state.account) : t("wallet.notConnected")} mono />
              <MiniStat label={language.startsWith("zh") ? "钱包" : t("common.wallet")} value={state.walletName || t("wallet.unknown")} />
              <MiniStat label={t("common.chainId")} value={state.walletChainId ? String(state.walletChainId) : "--"} />
              <MiniStat label={language.startsWith("zh") ? "网络检查" : "Preflight"} value={state.preflight.reason} />
              <MiniStat
                label={language.startsWith("zh") ? "同步时间" : "Synced"}
                value={formatSyncLabel(settlementState.lastSyncedAt, language)}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill label={t("dashboard.preflight.chain")} ok={state.preflight.chainOk} />
              <StatusPill label={t("dashboard.preflight.contract")} ok={state.preflight.contractOk} />
              <StatusPill label={t("dashboard.preflight.notifier")} ok={state.preflight.notifierOk} />
              <StatusPill label={t("dashboard.preflight.tokenAllowlist")} ok={state.preflight.tokenAllowed} />
            </div>
          </article>

          <article className="rounded-[28px] border border-black/8 bg-white/92 p-5 shadow-[0_16px_40px_rgba(16,17,19,0.04)]">
            <p className="text-[12px] font-semibold tracking-[0.16em] text-black/38">{copy.consoleActivityTitle}</p>
            <div className="mt-4 space-y-3">
              {state.recentActivities.length === 0 ? (
                <div className="rounded-[20px] border border-black/8 bg-[#fff9fc] p-4 text-sm text-black/56">
                  {t("dashboard.recentActivityEmpty")}
                </div>
              ) : (
                state.recentActivities.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-[20px] border border-black/8 bg-[#fff9fc] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-black">{item.title}</p>
                      <span className="text-[11px] text-black/34">{item.timestampLabel}</span>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-black/58">{item.description}</p>
                  </div>
                ))
              )}
            </div>
          </article>

          {isAdmin ? (
            <article className="rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,247,251,0.96),rgba(255,253,254,0.96))] p-5 text-sm leading-7 text-black/58 shadow-[0_16px_40px_rgba(16,17,19,0.04)]">
              {language.startsWith("zh")
                ? "管理员地址已连接。当前界面仍保持在产品演示视角，不把运维入口放到中心位置。"
                : "Admin access is connected, but this page stays focused on the demo product flow instead of ops."}
            </article>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ConsoleEmptyState({
  copy,
  language,
  t,
  state,
  selectedSettlementTokenOption,
  settlementState,
  preflightReadyCount,
  onOpenCreate,
  onConnectWallet,
}: {
  copy: AppCopy;
  language: Language;
  t: (key: string, vars?: Record<string, string | number>) => string;
  state: ReturnType<typeof usePolkaStream>["state"];
  selectedSettlementTokenOption: SettlementTokenOption | null;
  settlementState: SettlementServiceState;
  preflightReadyCount: number;
  onOpenCreate: () => void;
  onConnectWallet: () => void;
}) {
  const isZh = language.startsWith("zh");

  const previewCards = [
    {
      title: isZh ? "使用进度" : "Usage progress",
      body: isZh
        ? "创建后会按每条流显示已释放、剩余金额和当前进度。"
        : "Each stream will show released amount, remaining balance, and progress.",
    },
    {
      title: isZh ? "当前余额" : "Current balance",
      body: isZh
        ? "你会直接看到 deposit、已提款和当前可领取金额。"
        : "Deposit, withdrawn amount, and current claimable balance appear here.",
    },
    {
      title: isZh ? "失败通知重试" : "Retry notify",
      body: isZh
        ? "如果 notify 失败，这里会高亮显示并直接提供 Retry Notify。"
        : "If notify fails, the row is highlighted and a Retry Notify action appears.",
    },
  ];

  const readinessCards = [
    {
      label: isZh ? "当前钱包" : t("common.wallet"),
      value: state.account ? shortAddress(state.account) : t("wallet.notConnected"),
      mono: Boolean(state.account),
    },
    {
      label: isZh ? "预检查" : "Preflight",
      value: isZh ? `已就绪 ${preflightReadyCount} / 4 项` : `${preflightReadyCount} / 4 ready`,
    },
    {
      label: isZh ? "当前代币" : t("common.selectedToken"),
      value: selectedSettlementTokenOption?.symbol ?? t("common.noTokenDetected"),
    },
    {
      label: isZh ? "结算 API" : t("common.api"),
      value: settlementState.apiReachable ? t("common.reachable") : t("common.offline"),
    },
  ];

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="relative overflow-hidden rounded-[28px] border border-[#ffd4e5] bg-[linear-gradient(180deg,rgba(255,242,248,0.98)_0%,rgba(255,248,251,0.98)_58%,rgba(255,255,255,0.98)_100%)] p-5 shadow-[0_20px_48px_rgba(255,92,164,0.08)] sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,92,164,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.24),transparent_54%)]" />

          <div className="relative z-10">
            <p className="text-[12px] font-semibold tracking-[0.16em] text-black/38">
              {isZh ? "准备第一条流支付" : "First stream ready"}
            </p>
            <h3 className="mt-3 font-display text-[1.55rem] font-semibold tracking-[-0.05em] text-black sm:text-[1.8rem]">
              {state.account
                ? isZh
                  ? "创建一条流支付，这里就会开始显示真实使用情况。"
                  : "Create one stream and this surface starts showing live usage."
                : isZh
                  ? "先连接钱包，再创建第一条流支付。"
                  : "Connect a wallet, then create your first stream."}
            </h3>
            <p className="mt-3 max-w-[620px] text-sm leading-7 text-black/62">
              {isZh
                ? "当前主区之所以为空，是因为还没有可展示的流支付。完成创建后，这里会切换成真实的流列表，并直接呈现余额、可领取金额和失败通知重试。"
                : "The main surface is empty because there are no live streams yet. After creation, it turns into a real stream list with balances, claimability, and retry actions."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                onClick={onOpenCreate}
                className="fx-rainbow-pink inline-flex h-10 items-center gap-2 rounded-full border border-[#ff5ca4]/18 bg-[#ff5ca4] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(255,92,164,0.22)] transition hover:bg-[#ff4d9a]"
              >
                <span>{copy.createButton}</span>
                <ArrowUpRight className="size-4" />
              </button>

              <button
                onClick={onConnectWallet}
                className="fx-rainbow-soft inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white/92 px-4 text-sm font-medium text-black shadow-[0_12px_28px_rgba(16,17,19,0.05)] transition hover:border-black/14 hover:bg-white"
              >
                <Wallet className="size-4" />
                <span>{state.account ? (isZh ? "切换钱包" : "Switch wallet") : t("wallet.connect")}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {readinessCards.map((item) => (
            <div
              key={item.label}
              className="rounded-[22px] border border-black/8 bg-white/86 px-4 py-4 shadow-[0_12px_30px_rgba(16,17,19,0.04)]"
            >
              <p className="text-[11px] font-semibold tracking-[0.14em] text-black/36">{item.label}</p>
              <p className={`mt-3 text-sm text-black ${item.mono ? "font-mono-ui text-xs" : "font-medium"}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {previewCards.map((item, index) => (
          <div
            key={item.title}
            className={`rounded-[24px] border px-4 py-4 shadow-[0_12px_28px_rgba(16,17,19,0.04)] ${
              index === 2 ? "border-[#ffd4e5] bg-[#fff7fa]" : "border-black/8 bg-white"
            }`}
          >
            <p className="text-[12px] font-semibold tracking-[0.14em] text-black/38">{item.title}</p>
            <p className="mt-3 text-sm leading-7 text-black/60">{item.body}</p>
          </div>
        ))}
      </div>

      {!state.account ? (
        <div className="rounded-[22px] border border-black/8 bg-[#fff9fc] px-4 py-4 text-sm leading-7 text-black/56">
          {isZh
            ? "连接钱包后，可以直接创建流支付；如果你是在演示 AI 结算，创建完成后再去右侧查看托管余额、可领取金额和结算状态会更顺。"
            : "Connect a wallet to create a stream. For the AI settlement demo, fund first, then use the right rail to inspect escrow, claimable balance, and settlement state."}
        </div>
      ) : null}
    </div>
  );
}

function BrandBlock({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={`font-display font-semibold tracking-[-0.04em] text-black ${compact ? "text-[1.1rem]" : "text-[1.02rem]"}`}>
        {title}
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/42">{subtitle}</p>
    </div>
  );
}

function LanguageSwitcher({
  language,
  onChange,
}: {
  language: Language;
  onChange: (lang: Language) => void;
}) {
  return (
    <label className="relative">
      <Languages className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/42" />
      <select
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
        className="h-10 appearance-none rounded-full border border-black/10 bg-white pl-9 pr-9 text-sm font-medium text-black shadow-[0_10px_25px_rgba(16,17,19,0.05)] outline-none transition hover:border-black/16"
      >
        {SURFACE_LANGUAGE_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-black/36" />
    </label>
  );
}

function WalletMenu({
  language,
  t,
  walletButtonLabel,
  walletMenuOpen,
  installedWalletOptions,
  preferredWallet,
  state,
  handleWalletButtonClick,
  setWalletMenuOpen,
  connectWallet,
}: {
  language: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  walletButtonLabel: string;
  walletMenuOpen: boolean;
  installedWalletOptions: WalletOption[];
  preferredWallet: WalletOption | null;
  state: ReturnType<typeof usePolkaStream>["state"];
  handleWalletButtonClick: () => void;
  setWalletMenuOpen: Dispatch<SetStateAction<boolean>>;
  connectWallet: (walletType: WalletType) => Promise<void>;
}) {
  return (
    <div className="relative">
      <button
        onClick={handleWalletButtonClick}
        className="fx-rainbow-soft inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black shadow-[0_10px_25px_rgba(16,17,19,0.06)] transition hover:border-black/16"
      >
        <Wallet className="size-4" />
        <span>{walletButtonLabel}</span>
        {state.account || installedWalletOptions.length !== 1 || !preferredWallet ? (
          <ChevronDown className="size-4 text-black/40" />
        ) : null}
      </button>

      {walletMenuOpen ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-[22px] border border-black/8 bg-white p-2 shadow-[0_28px_70px_rgba(16,17,19,0.14)]">
          {state.account ? (
            <div className="rounded-[16px] border border-black/8 bg-[#fff8fb] px-3 py-3">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-black/38">
                {language.startsWith("zh") ? "当前钱包" : "Wallet"}
              </p>
              <p className="mt-2 text-sm font-semibold text-black">{state.walletName || t("wallet.unknown")}</p>
              <p className="mt-1 font-mono-ui text-xs text-black/52">{shortAddress(state.account)}</p>
            </div>
          ) : null}

          {installedWalletOptions.length > 0 ? (
            <div className="mt-2 space-y-1">
              <p className="px-3 pb-1 pt-1 text-[11px] font-semibold tracking-[0.16em] text-black/38">
                {state.account
                  ? language.startsWith("zh")
                    ? "切换钱包"
                    : "Switch wallet"
                  : language.startsWith("zh")
                    ? "可用钱包"
                    : "Available wallets"}
              </p>
              {installedWalletOptions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setWalletMenuOpen(false);
                    void connectWallet(item.id);
                  }}
                  disabled={state.isConnecting || !state.isHydrated}
                  className="flex w-full items-center justify-between rounded-[16px] border border-transparent px-3 py-3 text-left text-sm text-black transition hover:border-black/8 hover:bg-[#fff5f9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-[11px] text-black/35">
                    {state.account && state.walletName === item.label
                      ? language.startsWith("zh")
                        ? "已连接"
                        : "Connected"
                      : language.startsWith("zh")
                        ? "点击连接"
                        : "Connect"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-2 rounded-[16px] border border-black/8 bg-[#fff8fb] px-3 py-3 text-sm leading-7 text-black/56">
              {language.startsWith("zh")
                ? "未检测到可用钱包，请先打开 MetaMask、SubWallet 或 Rabby。"
                : "No compatible wallet detected. Please open MetaMask, SubWallet, or Rabby first."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function HeroBadge({
  label,
  tone,
}: {
  label: string;
  tone: "lime" | "pink" | "muted";
}) {
  const className =
    tone === "lime"
      ? "border-[#cbe05f] bg-[#f5f9d7] text-[#576300]"
      : tone === "pink"
        ? "border-[#ffbfd8] bg-[#fff1f7] text-[#b53b78]"
        : "border-black/8 bg-black/[0.03] text-black/50";

  return (
    <span className={`rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-[0.01em] ${className}`}>
      {label}
    </span>
  );
}

function PersonaSurface({
  language,
  groups,
  onOpenCreate,
  onOpenConsole,
}: {
  language: Language;
  groups: PersonaGroup[];
  onOpenCreate: () => void;
  onOpenConsole: () => void;
}) {
  const [activeGroupId, setActiveGroupId] = useState<PersonaGroup["id"] | null>(null);
  const activeGroup = activeGroupId ? groups.find((group) => group.id === activeGroupId) ?? null : null;
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [surfaceHeight, setSurfaceHeight] = useState<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const syncHeight = () => {
      setSurfaceHeight(node.getBoundingClientRect().height);
    };

    syncHeight();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncHeight());
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeGroupId, activeRoleId, groups, language]);

  useEffect(() => {
    if (!activeGroup) {
      setActiveRoleId(null);
      return;
    }

    if (activeRoleId && !activeGroup.roles.some((role) => role.id === activeRoleId)) {
      setActiveRoleId(null);
    }
  }, [activeGroup, activeRoleId]);

  useEffect(() => {
    if (activeGroupId && !groups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(null);
      setActiveRoleId(null);
    }
  }, [groups, activeGroupId]);

  const transitionPersona = (update: () => void) => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }

    setIsTransitioning(true);
    transitionTimerRef.current = window.setTimeout(() => {
      startTransition(() => {
        update();
      });

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setIsTransitioning(false);
        });
      });

      transitionTimerRef.current = null;
    }, 120);
  };

  const activeRole =
    activeGroup && activeRoleId ? activeGroup.roles.find((role) => role.id === activeRoleId) ?? null : null;

  const detailAction = activeRole ? (
    activeRole.action === "create" ? (
      <button
        onClick={onOpenCreate}
        className="fx-rainbow-pink inline-flex items-center gap-2 rounded-full border border-[#ff5ca4]/18 bg-[#ff5ca4] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(255,92,164,0.18)] transition hover:bg-[#ff4d9a]"
      >
        <span>{activeRole.ctaLabel}</span>
        <ArrowUpRight className="size-4" />
      </button>
    ) : activeRole.action === "console" ? (
      <button
        onClick={onOpenConsole}
        className="fx-rainbow-dark inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#101113] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,17,19,0.12)] transition hover:bg-black"
      >
        <span>{activeRole.ctaLabel}</span>
        <ArrowUpRight className="size-4" />
      </button>
    ) : (
      <a
        href={activeRole.action === "agentScenario" ? PRODUCT_LINKS.agentScenario : PRODUCT_LINKS.agentSkillGuide}
        target="_blank"
        rel="noreferrer"
        className="fx-rainbow-soft inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-[0_12px_28px_rgba(16,17,19,0.05)] transition hover:border-black/14"
      >
        <span>{activeRole.ctaLabel}</span>
        <ArrowUpRight className="size-4" />
      </a>
    )
  ) : null;

  return (
    <div
      className="persona-shell mt-6 rounded-[28px] border border-[#ffd4e5] bg-[linear-gradient(180deg,rgba(255,241,247,0.94),rgba(255,252,253,0.97))] shadow-[0_16px_36px_rgba(255,92,164,0.08)]"
      style={surfaceHeight ? { height: `${surfaceHeight + 2}px` } : undefined}
    >
      <div
        ref={contentRef}
        data-phase={isTransitioning ? "switching" : "idle"}
        className="persona-stage p-4 sm:p-5"
      >
        {!activeGroup ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => {
              const Icon = group.id === "consumer" ? User : Building2;

              return (
                <button
                  key={group.id}
                  onClick={() =>
                    transitionPersona(() => {
                      setActiveGroupId(group.id);
                      setActiveRoleId(null);
                    })
                  }
                  className="rounded-[24px] border border-black/8 bg-white/80 px-5 py-5 text-left shadow-[0_14px_34px_rgba(16,17,19,0.04)] transition hover:border-black/12 hover:bg-white hover:shadow-[0_16px_40px_rgba(255,92,164,0.08)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-full border border-[#ffc5dc] bg-[#fff7fa] text-[#c74380]">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.16em] text-black/34">
                        {language === "zh-TW" ? "角色卡片" : language.startsWith("zh") ? "角色卡片" : "Role Card"}
                      </p>
                      <h3 className="mt-1 text-[1.18rem] font-semibold text-black">{group.title}</h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-black/58">{group.summary}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-black/34">
                  {language === "zh-TW" ? "角色卡片" : language.startsWith("zh") ? "角色卡片" : "Role Card"}
                </p>
                <h3 className="mt-2 font-display text-[1.35rem] font-semibold tracking-[-0.04em] text-black">
                  {activeGroup.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-black/58">{activeGroup.summary}</p>
              </div>

              <button
                onClick={() =>
                  transitionPersona(() => {
                    setActiveGroupId(null);
                    setActiveRoleId(null);
                  })
                }
                className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-3.5 py-2 text-sm font-medium text-black/68 transition hover:border-black/14 hover:text-black"
              >
                <ArrowLeft className="size-4" />
                {language.startsWith("zh") ? "返回身份选择" : "Back to roles"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeGroup.roles.map((role) => {
                const active = role.id === activeRole?.id;
                const Icon =
                  role.id.includes("agent") ? Bot : role.id.includes("service") ? Store : role.id.includes("personal") ? Handshake : User;

                return (
                  <button
                    key={role.id}
                    onClick={() => transitionPersona(() => setActiveRoleId(role.id))}
                    className={`rounded-[22px] border px-4 py-4 text-left transition ${
                      active
                        ? "border-[#ffbfd8] bg-white shadow-[0_14px_34px_rgba(255,92,164,0.08)]"
                        : "border-black/8 bg-white/78 hover:border-black/12 hover:bg-white/92"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex size-9 items-center justify-center rounded-full border ${
                          active ? "border-[#ffc5dc] text-[#c74380]" : "border-black/8 text-black/52"
                        }`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-black">{role.title}</p>
                        <p className="mt-1 text-xs leading-6 text-black/48">{role.summary}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {activeRole ? (
              <div className="mt-4 rounded-[24px] border border-black/8 bg-white p-5 shadow-[0_14px_34px_rgba(16,17,19,0.04)]">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-black/34">
                  {language === "zh-TW" ? "建議路徑" : language.startsWith("zh") ? "推荐路径" : "Recommended Path"}
                </p>
                <h4 className="mt-3 font-display text-[1.4rem] font-semibold tracking-[-0.04em] text-black">
                  {activeRole.title}
                </h4>
                <p className="mt-3 text-sm leading-7 text-black/60">{activeRole.detail}</p>

                <div className="mt-4 grid gap-2">
                  {activeRole.steps.map((step, index) => (
                    <div
                      key={`${activeRole.id}-${step}`}
                      className="rounded-[16px] border border-black/8 bg-[#fff9fc] px-4 py-3 text-sm text-black/66"
                    >
                      <span className="mr-2 text-black/36">{index + 1}.</span>
                      {step}
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {detailAction}
                  <span className="text-xs text-black/38">
                    {activeRole.action === "skillGuide"
                      ? language.startsWith("zh")
                        ? language === "zh-TW"
                          ? "查看 Skill 與接入說明"
                          : "查看 Skill 与接入说明"
                        : "Open skill and integration guide"
                      : activeRole.action === "console"
                        ? language.startsWith("zh")
                          ? language === "zh-TW"
                            ? "進入控制台查看即時數據"
                            : "进入控制台查看实时数据"
                          : "Jump into the console with live data"
                        : language.startsWith("zh")
                          ? language === "zh-TW"
                            ? "直接進入建立流程"
                            : "直接进入创建流程"
                          : "Move directly into the creation flow"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] border border-black/8 bg-white/76 px-4 py-4 text-sm text-black/54">
                {language === "zh-TW"
                  ? "繼續點擊一張角色卡片，查看對應的詳細路徑。"
                  : language.startsWith("zh")
                    ? "继续点击一张角色卡片，查看对应的详细路径。"
                    : "Choose a role card to reveal the detailed path."}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScenarioLinkCard({
  eyebrow,
  title,
  body,
  cta,
  meta,
  href,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  meta: string;
  href: string;
}) {
  return (
    <div className="mt-6 rounded-[26px] border border-[#ffd4e5] bg-[linear-gradient(180deg,rgba(255,241,247,0.96),rgba(255,252,253,0.96))] p-5 shadow-[0_16px_36px_rgba(255,92,164,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[520px]">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-full border border-[#ffc5dc] bg-white text-[#b53b78]">
              <Bot className="size-4" />
            </span>
            <p className="text-[12px] font-semibold tracking-[0.16em] text-black/38">{eyebrow}</p>
          </div>
          <h3 className="mt-3 font-display text-[1.35rem] font-semibold tracking-[-0.04em] text-black">{title}</h3>
          <p className="mt-3 text-sm leading-7 text-black/60">{body}</p>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="fx-rainbow-soft inline-flex items-center justify-between gap-4 rounded-[20px] border border-black/8 bg-white px-4 py-3 text-left shadow-[0_12px_30px_rgba(16,17,19,0.05)] transition hover:border-black/14 hover:bg-white/96 sm:min-w-[220px]"
        >
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-black/34">{meta}</p>
            <p className="mt-1 text-sm font-semibold text-black">{cta}</p>
          </div>
          <ArrowUpRight className="size-4 text-black/56" />
        </a>
      </div>
    </div>
  );
}

function FooterIconLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
      title={label}
      aria-label={label}
      className="group inline-flex size-11 items-center justify-center rounded-[18px] border border-black/8 bg-white text-black/58 shadow-[0_10px_24px_rgba(16,17,19,0.04)] transition hover:border-black/14 hover:bg-[#fff8fb] hover:text-black"
    >
      {icon}
      <span className="sr-only">{label}</span>
    </a>
  );
}

function CreateSheet({
  open,
  onClose,
  language,
  notice,
  userError,
  account,
  form,
  setForm,
  servicePlanPreview,
  servicePlanError,
  isLoadingServicePlan,
  presetTokens,
  preflight,
  isPreflightChecking,
  createDisabled,
  createDisabledReason,
  isCreating,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  language: string;
  notice: string;
  userError: string;
  account: string | null;
  form: CreateFormState;
  setForm: CreateFormSetter;
  servicePlanPreview: ServicePlanPreview | null;
  servicePlanError: string;
  isLoadingServicePlan: boolean;
  presetTokens: PresetToken[];
  preflight: PreflightState;
  isPreflightChecking: boolean;
  createDisabled: boolean;
  createDisabledReason: string;
  isCreating: boolean;
  onCreate: () => Promise<void>;
}) {
  const { t } = useI18n();
  const selectedPreset = presetTokens.find((preset) => preset.address.toLowerCase() === form.token.toLowerCase());
  const modeOptions: CreateMode[] = ["immediate", "pending", "plan"];
  const triggerOptions: Array<Exclude<TriggerPolicyName, "NONE">> = [
    "SENDER_ONLY",
    "RECEIVER_ONLY",
    "EITHER_PARTY",
    "BOTH_PARTIES",
    "AUTHORIZED_OPERATOR",
  ];
  const summaryToken =
    form.createMode === "plan"
      ? servicePlanPreview
        ? `${servicePlanPreview.tokenSymbol} · ${shortAddress(servicePlanPreview.token)}`
        : "--"
      : selectedPreset?.symbol ?? (form.token || "--");
  const summaryReceiver =
    form.createMode === "plan"
      ? servicePlanPreview
        ? shortAddress(servicePlanPreview.provider)
        : "--"
      : form.receiver || "--";
  const serviceRefDraft =
    form.serviceRef.trim().length > 20 ? `${form.serviceRef.trim().slice(0, 20)}...` : form.serviceRef.trim() || "--";

  if (!open) return null;

  return (
    <SheetShell onClose={onClose} centered>
      <div className="space-y-4">
        <SheetHeader
          eyebrow={language.startsWith("zh") ? "创建" : "Create"}
          title={language.startsWith("zh") ? "创建流支付" : "Create Stream"}
          description={
            language.startsWith("zh")
              ? "填写接收方、稳定币、金额和持续时间，即可创建一条新的流支付。"
              : "Fill in receiver, token, deposit, and duration to create a new payment stream."
          }
          onClose={onClose}
        />

        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {userError ? <Alert tone="error">{userError}</Alert> : null}
        {form.createMode === "plan" && servicePlanError && !userError ? <Alert tone="error">{servicePlanError}</Alert> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="rounded-[26px] border border-black/8 bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {modeOptions.map((mode) => {
                const active = form.createMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setForm((prev) => ({ ...prev, createMode: mode }))}
                    className={`rounded-[22px] border px-4 py-4 text-left transition ${
                      active
                        ? "border-[#ffbfd8] bg-[#fff6fa] shadow-[0_12px_28px_rgba(255,92,164,0.08)]"
                        : "border-black/8 bg-white hover:border-black/14 hover:bg-[#fffafc]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-black">{formatCreateModeLabel(mode, language)}</p>
                    <p className="mt-2 text-xs leading-6 text-black/54">{formatCreateModeBody(mode, language)}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("streams.sender")}
                hint={language.startsWith("zh") ? "连接后自动使用当前钱包作为发送方" : "The connected wallet will be used as the sender"}
              >
                <div className="input-shell flex min-h-12 items-center bg-[#fff9fc]">
                  <span className="font-mono-ui text-xs text-black/78">
                    {account ? shortAddress(account) : language.startsWith("zh") ? "未连接" : t("wallet.notConnected")}
                  </span>
                </div>
              </Field>

              {form.createMode === "plan" ? (
                <Field
                  label={language.startsWith("zh") ? "Provider" : "Provider"}
                  hint={language.startsWith("zh") ? "ServicePlan 决定收款方，买方只需按计划注资" : "Receiver is fixed by the ServicePlan"}
                >
                  <div className="input-shell flex min-h-12 items-center bg-[#fff9fc]">
                    <span className="font-mono-ui text-xs text-black/78">
                      {servicePlanPreview ? shortAddress(servicePlanPreview.provider) : "--"}
                    </span>
                  </div>
                </Field>
              ) : (
                <Field
                  label={t("streams.receiver")}
                  hint={language.startsWith("zh") ? "填写接收方地址，用于接收流支付" : t("create.receiverHint")}
                >
                  <input
                    value={form.receiver}
                    onChange={(event) => setForm((prev) => ({ ...prev, receiver: event.target.value }))}
                    placeholder="0x..."
                    className="input-shell"
                  />
                </Field>
              )}
            </div>

            {form.createMode === "plan" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                <Field
                  label={language.startsWith("zh") ? "Plan ID" : "Plan ID"}
                  hint={language.startsWith("zh") ? "加载 provider 预先定义的套餐边界" : "Load provider-defined guardrails first"}
                >
                  <input
                    value={form.planId}
                    onChange={(event) => setForm((prev) => ({ ...prev, planId: event.target.value }))}
                    placeholder="1"
                    className="input-shell"
                  />
                </Field>

                <Field
                  label={t("common.token")}
                  hint={language.startsWith("zh") ? "ServicePlan 锁定结算币种，前端只展示只读结果" : "Token is fixed by the ServicePlan"}
                >
                  <div className="input-shell flex min-h-12 items-center bg-[#fff9fc]">
                    <span className="font-mono-ui text-xs text-black/78">{summaryToken}</span>
                  </div>
                </Field>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                <Field
                  label={t("common.token")}
                  hint={language.startsWith("zh") ? "填写稳定币地址，或从右侧快速选择" : t("create.tokenHint")}
                >
                  <input
                    value={form.token}
                    onChange={(event) => setForm((prev) => ({ ...prev, token: event.target.value }))}
                    placeholder="0x..."
                    className="input-shell"
                  />
                </Field>

                <Field label={language.startsWith("zh") ? "快速代币" : t("create.presetTokens")}>
                  <select
                    value={selectedPreset?.address ?? ""}
                    onChange={(event) => {
                      const nextToken = event.target.value;
                      if (!nextToken) return;
                      setForm((prev) => ({ ...prev, token: nextToken }));
                    }}
                    className="input-shell"
                  >
                    <option value="">{t("create.selectToken")}</option>
                    {presetTokens.map((preset) => (
                      <option key={preset.address} value={preset.address}>
                        {preset.symbol}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label={t("streams.deposit")}>
                <input
                  value={form.deposit}
                  onChange={(event) => setForm((prev) => ({ ...prev, deposit: event.target.value }))}
                  placeholder="1000"
                  className="input-shell"
                />
              </Field>

              <Field label={t("create.durationSeconds")}>
                <input
                  value={form.durationSeconds}
                  onChange={(event) => setForm((prev) => ({ ...prev, durationSeconds: event.target.value }))}
                  placeholder="2592000"
                  className="input-shell"
                />
              </Field>

              {form.createMode === "plan" ? (
                <Field
                  label={t("create.cliffSeconds")}
                  hint={language.startsWith("zh") ? "cliff 由 ServicePlan 固定" : "Cliff is defined by the ServicePlan"}
                >
                  <div className="input-shell flex min-h-12 items-center bg-[#fff9fc]">
                    <span className="font-mono-ui text-xs text-black/78">
                      {servicePlanPreview ? formatDurationLabel(servicePlanPreview.cliffInSeconds.toString(), language) : "--"}
                    </span>
                  </div>
                </Field>
              ) : (
                <Field label={t("create.cliffSeconds")}>
                  <input
                    value={form.cliffSeconds}
                    onChange={(event) => setForm((prev) => ({ ...prev, cliffSeconds: event.target.value }))}
                    placeholder="0"
                    className="input-shell"
                  />
                </Field>
              )}
            </div>

            {(form.createMode === "pending" || form.createMode === "plan") && (
              <div className="mt-4 rounded-[24px] border border-[#ffd9e8] bg-[#fff8fb] p-4">
                <p className="text-[12px] font-semibold tracking-[0.16em] text-black/36">
                  {language.startsWith("zh") ? "激活与服务触发" : "Activation and service trigger"}
                </p>

                {form.createMode === "pending" ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                      label={language.startsWith("zh") ? "Trigger policy" : "Trigger policy"}
                      hint={language.startsWith("zh") ? "创建时先锁预算，满足触发条件后才开始计费" : "Budget is locked first and charging starts only after activation"}
                    >
                      <select
                        value={form.triggerPolicy}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            triggerPolicy: event.target.value as Exclude<TriggerPolicyName, "NONE">,
                          }))
                        }
                        className="input-shell"
                      >
                        {triggerOptions.map((policy) => (
                          <option key={policy} value={policy}>
                            {formatTriggerPolicyLabel(policy, language)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field
                      label={language.startsWith("zh") ? "Activation window" : "Activation window"}
                      hint={language.startsWith("zh") ? "单位秒，0 表示不设置截止时间" : "In seconds. Use 0 for no deadline"}
                    >
                      <input
                        value={form.activationWindowSeconds}
                        onChange={(event) => setForm((prev) => ({ ...prev, activationWindowSeconds: event.target.value }))}
                        placeholder="3600"
                        className="input-shell"
                      />
                    </Field>

                    <Field
                      label={language.startsWith("zh") ? "Service reference" : "Service reference"}
                      hint={language.startsWith("zh") ? "可填订单号、任务号或服务请求 ID；前端会规范化为 bytes32" : "Order ID, request ID, or service handle; normalized to bytes32 before submit"}
                    >
                      <input
                        value={form.serviceRef}
                        onChange={(event) => setForm((prev) => ({ ...prev, serviceRef: event.target.value }))}
                        placeholder={language.startsWith("zh") ? "例如 order-2026-001" : "for example order-2026-001"}
                        className="input-shell"
                      />
                    </Field>

                    <Field
                      label={language.startsWith("zh") ? "Authorized activator" : "Authorized activator"}
                      hint={
                        form.triggerPolicy === "AUTHORIZED_OPERATOR"
                          ? language.startsWith("zh")
                            ? "当策略为授权操作员时必填"
                            : "Required when trigger policy is authorized operator"
                          : language.startsWith("zh")
                            ? "仅授权操作员模式需要"
                            : "Only used for authorized-operator mode"
                      }
                    >
                      <input
                        value={form.authorizedActivator}
                        onChange={(event) => setForm((prev) => ({ ...prev, authorizedActivator: event.target.value }))}
                        placeholder={form.triggerPolicy === "AUTHORIZED_OPERATOR" ? "0x..." : "--"}
                        className="input-shell"
                        disabled={form.triggerPolicy !== "AUTHORIZED_OPERATOR"}
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                      label={language.startsWith("zh") ? "Service reference" : "Service reference"}
                      hint={language.startsWith("zh") ? "绑定这次采购或服务交付的外部标识" : "Bind the funding action to an external order or service reference"}
                    >
                      <input
                        value={form.serviceRef}
                        onChange={(event) => setForm((prev) => ({ ...prev, serviceRef: event.target.value }))}
                        placeholder={language.startsWith("zh") ? "例如 gpu-cluster-7" : "for example gpu-cluster-7"}
                        className="input-shell"
                      />
                    </Field>

                    <Field
                      label={language.startsWith("zh") ? "Trigger policy" : "Trigger policy"}
                      hint={language.startsWith("zh") ? "ServicePlan 读取为只读策略" : "Loaded from the ServicePlan as read-only"}
                    >
                      <div className="input-shell flex min-h-12 items-center bg-[#fffdfd]">
                        <span className="text-sm text-black/72">
                          {servicePlanPreview ? formatTriggerPolicyLabel(servicePlanPreview.triggerPolicyName, language) : "--"}
                        </span>
                      </div>
                    </Field>
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="space-y-4">
            <section className="rounded-[26px] border border-black/8 bg-[#fff7fa] p-5">
              <p className="text-[12px] font-semibold tracking-[0.16em] text-black/40">
                {language.startsWith("zh") ? "创建摘要" : "Summary"}
              </p>
              <div className="mt-4 grid gap-2">
                <MiniStat label={language.startsWith("zh") ? "模式" : "Mode"} value={formatCreateModeLabel(form.createMode, language)} />
                <MiniStat label={t("common.wallet")} value={account ? shortAddress(account) : t("wallet.notConnected")} mono />
                <MiniStat label={language.startsWith("zh") ? "收款方" : "Receiver"} value={summaryReceiver} mono />
                <MiniStat label={t("common.token")} value={summaryToken} mono />
                <MiniStat label={t("common.duration")} value={formatDurationLabel(form.durationSeconds, language)} />
                <MiniStat
                  label={t("common.cliff")}
                  value={
                    form.createMode === "plan" && servicePlanPreview
                      ? formatDurationLabel(servicePlanPreview.cliffInSeconds.toString(), language)
                      : formatDurationLabel(form.cliffSeconds || "0", language)
                  }
                />
                <MiniStat
                  label={language.startsWith("zh") ? "Trigger" : "Trigger"}
                  value={
                    form.createMode === "plan" && servicePlanPreview
                      ? formatTriggerPolicyLabel(servicePlanPreview.triggerPolicyName, language)
                      : form.createMode === "pending"
                        ? formatTriggerPolicyLabel(form.triggerPolicy, language)
                        : language.startsWith("zh")
                          ? "交易确认后开始"
                          : "Start on confirmation"
                  }
                />
                <MiniStat label={language.startsWith("zh") ? "服务引用" : "Service ref"} value={serviceRefDraft} mono />
              </div>
              <p className="mt-4 text-sm leading-7 text-black/60">
                {formatCreateModeBody(form.createMode, language)}
              </p>
            </section>

            {form.createMode === "plan" ? (
              <section className="rounded-[26px] border border-black/8 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold tracking-[0.16em] text-black/40">
                      {language.startsWith("zh") ? "ServicePlan" : "ServicePlan"}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-black/62">
                      {language.startsWith("zh")
                        ? "provider 先定义资金、时长和触发边界，buyer 只在可接受范围内注资。"
                        : "Provider sets the acceptable funding, duration, and activation boundaries before the buyer funds."}
                    </p>
                  </div>
                  {isLoadingServicePlan ? <Loader2 className="size-4 animate-spin text-[#ff5ca4]" /> : null}
                </div>

                <div className="mt-4 grid gap-2">
                  <MiniStat label={language.startsWith("zh") ? "Provider" : "Provider"} value={servicePlanPreview ? shortAddress(servicePlanPreview.provider) : "--"} mono />
                  <MiniStat
                    label={language.startsWith("zh") ? "存入范围" : "Deposit range"}
                    value={
                      servicePlanPreview
                        ? `${formatTokenAmount(servicePlanPreview.minDeposit, servicePlanPreview.tokenDecimals, servicePlanPreview.tokenSymbol)} - ${formatTokenAmount(servicePlanPreview.maxDeposit, servicePlanPreview.tokenDecimals, servicePlanPreview.tokenSymbol)}`
                        : "--"
                    }
                  />
                  <MiniStat
                    label={language.startsWith("zh") ? "时长范围" : "Duration range"}
                    value={
                      servicePlanPreview
                        ? `${formatDurationLabel(servicePlanPreview.minDuration.toString(), language)} - ${formatDurationLabel(servicePlanPreview.maxDuration.toString(), language)}`
                        : "--"
                    }
                  />
                  <MiniStat
                    label={language.startsWith("zh") ? "激活窗口" : "Activation window"}
                    value={servicePlanPreview ? formatDurationLabel(servicePlanPreview.activationWindow.toString(), language) : "--"}
                  />
                </div>
              </section>
            ) : null}

            <section className="rounded-[26px] border border-black/8 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.16em] text-black/40">{t("common.preflight")}</p>
                  <p className="mt-2 text-sm leading-7 text-black/62">{createDisabledReason}</p>
                </div>
                {isPreflightChecking ? <Loader2 className="size-4 animate-spin text-[#ff5ca4]" /> : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { label: t("create.precheckChain", { id: "336699" }), ok: preflight.chainOk },
                  { label: t("create.precheckContract"), ok: preflight.contractOk },
                  { label: t("create.precheckNotifier"), ok: preflight.notifierOk },
                  { label: t("create.precheckToken"), ok: preflight.tokenAllowed },
                ].map((item) => (
                  <StatusPill key={item.label} label={item.label} ok={item.ok} />
                ))}
              </div>

              {!preflight.notifierOk && preflight.chainOk && preflight.contractOk ? (
                <p className="mt-4 text-xs leading-6 text-black/48">
                  {language.startsWith("zh")
                    ? "Notifier 当前不健康不会阻断链上创建；如果通知失败，可以在控制台的 stream 行里补做 retry。"
                    : "Notifier health does not block onchain creation. If notify fails, recover it later from the stream row."}
                </p>
              ) : null}

              <button
                onClick={() => void onCreate()}
                disabled={createDisabled}
                className="fx-rainbow-dark mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#101113] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {isCreating
                    ? t("create.creating")
                    : form.createMode === "immediate"
                      ? t("create.button")
                      : form.createMode === "pending"
                        ? language.startsWith("zh")
                          ? "创建待激活流"
                          : "Create Pending Stream"
                        : language.startsWith("zh")
                          ? "按 ServicePlan 注资"
                          : "Fund ServicePlan"}
                </span>
                {isCreating ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
              </button>
            </section>
          </div>
        </div>
      </div>
    </SheetShell>
  );
}

function StreamRow({
  stream,
  language,
  pendingAction,
  retryingNotifyKeys,
  actionsDisabled,
  disabledReason,
  onWithdraw,
  onPause,
  onResume,
  onCancel,
  onActivate,
  onCancelPending,
  onConfirmSender,
  onConfirmReceiver,
  onRetryNotify,
}: {
  stream: StreamCardData;
  language: string;
  pendingAction: ActionType | null;
  retryingNotifyKeys: Record<string, boolean>;
  actionsDisabled: boolean;
  disabledReason: string;
  onWithdraw: (streamId: bigint) => Promise<void>;
  onPause: (streamId: bigint) => Promise<void>;
  onResume: (streamId: bigint) => Promise<void>;
  onCancel: (streamId: bigint) => Promise<void>;
  onActivate: (streamId: bigint) => Promise<void>;
  onCancelPending: (streamId: bigint) => Promise<void>;
  onConfirmSender: (streamId: bigint) => Promise<void>;
  onConfirmReceiver: (streamId: bigint) => Promise<void>;
  onRetryNotify: (streamId: bigint, withdrawId: bigint) => Promise<void>;
}) {
  const { t } = useI18n();
  const streamMode = deriveStreamMode(stream);
  const canWithdraw =
    stream.role === "receiver" &&
    (stream.status === "active" || stream.status === "paused" || stream.status === "completed") &&
    stream.owed > 0n;
  const canPause = stream.role === "sender" && stream.status === "active";
  const canResume = stream.role === "sender" && stream.status === "paused";
  const canCancel = stream.role === "sender" && (stream.status === "active" || stream.status === "paused");
  const canCancelPending = stream.role === "sender" && stream.status === "pending";
  const canConfirmSender =
    stream.status === "pending" &&
    stream.triggerPolicyName === "BOTH_PARTIES" &&
    stream.role === "sender" &&
    !stream.senderConfirmed;
  const canConfirmReceiver =
    stream.status === "pending" &&
    stream.triggerPolicyName === "BOTH_PARTIES" &&
    stream.role === "receiver" &&
    !stream.receiverConfirmed;
  const canActivate =
    stream.status === "pending" &&
    (() => {
      switch (stream.triggerPolicyName) {
        case "SENDER_ONLY":
          return stream.role === "sender";
        case "RECEIVER_ONLY":
          return stream.role === "receiver";
        case "EITHER_PARTY":
          return stream.role === "sender" || stream.role === "receiver";
        case "BOTH_PARTIES":
          return stream.senderConfirmed && stream.receiverConfirmed;
        case "AUTHORIZED_OPERATOR":
          return (
            (stream.role === "sender" && stream.authorizedActivator.toLowerCase() === stream.sender.toLowerCase()) ||
            (stream.role === "receiver" && stream.authorizedActivator.toLowerCase() === stream.receiver.toLowerCase())
          );
        default:
          return false;
      }
    })();
  const { usedAmount, remainingAmount, progressPct } = getStreamUsageMetrics(stream);
  const stateLabel =
    stream.status === "pending"
      ? t("streams.status.pending")
      : stream.status === "paused"
        ? t("streams.status.paused")
        : stream.status === "completed"
          ? t("streams.status.completed")
          : stream.status === "canceled"
            ? t("streams.status.canceled")
            : stream.status === "expired"
              ? t("streams.status.expired")
              : t("streams.status.active");
  const readinessLabel =
    stream.triggerPolicyName === "BOTH_PARTIES"
      ? language.startsWith("zh")
        ? `${stream.senderConfirmed ? "付款方已确认" : "付款方待确认"} / ${stream.receiverConfirmed ? "收款方已确认" : "收款方待确认"}`
        : `${stream.senderConfirmed ? "Sender ready" : "Sender pending"} / ${stream.receiverConfirmed ? "Receiver ready" : "Receiver pending"}`
      : stream.status === "pending"
        ? language.startsWith("zh")
          ? "等待触发"
          : "Awaiting trigger"
        : stream.activatedAt > 0n
          ? language.startsWith("zh")
            ? `已激活 ${formatTimestampLabel(stream.activatedAt, language)}`
            : `Activated ${formatTimestampLabel(stream.activatedAt, language)}`
          : "--";

  return (
    <div className="rounded-[26px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,249,252,0.96),rgba(255,255,255,0.96))] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-black">
              #{stream.streamId.toString()} · {stream.tokenSymbol}
            </p>
            <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] text-black/56">
              {stream.role === "sender"
                ? language.startsWith("zh")
                  ? "我在付款"
                  : "Paying"
                : language.startsWith("zh")
                  ? "我在收款"
                  : "Receiving"}
            </span>
            <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] text-black/56">
              {formatCreateModeLabel(streamMode, language)}
            </span>
            {stream.failedNotifies.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#ffd0e1] bg-white px-2.5 py-1 text-[11px] font-medium text-[#c03a76]">
                <CircleAlert className="size-3" />
                {language.startsWith("zh") ? "需重试" : "Retry"}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-black/44">
            {shortAddress(stream.sender)}
            {" -> "}
            {shortAddress(stream.receiver)}
          </p>
        </div>
        <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] text-black/56">
          {stateLabel}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[12px] text-black/48">
          <span>{language.startsWith("zh") ? "使用进度" : "Usage"}</span>
          <span>{progressPct.toFixed(0)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/6">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#101113_0%,#ff5ca4_100%)]"
            style={{ width: `${progressPct === 0 ? 0 : Math.max(progressPct, 3)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat
          label={language.startsWith("zh") ? "总存入" : t("streams.deposit")}
          value={`${formatStreamAmount(stream.deposit, stream.tokenDecimals)} ${stream.tokenSymbol}`}
        />
        <MiniStat
          label={language.startsWith("zh") ? "已使用" : "Used"}
          value={formatTokenAmount(usedAmount, stream.tokenDecimals, stream.tokenSymbol)}
        />
        <MiniStat
          label={language.startsWith("zh") ? "当前可领取" : t("streams.claimable")}
          value={`${formatStreamAmount(stream.owed, stream.tokenDecimals)} ${stream.tokenSymbol}`}
        />
        <MiniStat
          label={language.startsWith("zh") ? "当前余额" : "Balance"}
          value={formatTokenAmount(remainingAmount, stream.tokenDecimals, stream.tokenSymbol)}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat
          label={language.startsWith("zh") ? "Trigger" : "Trigger"}
          value={
            stream.triggerPolicyName === "NONE"
              ? language.startsWith("zh")
                ? "交易确认即开始"
                : "Start on confirmation"
              : formatTriggerPolicyLabel(stream.triggerPolicyName, language)
          }
        />
        <MiniStat
          label={language.startsWith("zh") ? "激活时间" : "Activation"}
          value={
            stream.status === "pending"
              ? formatTimestampLabel(stream.activationDeadline, language)
              : stream.activatedAt > 0n
                ? formatTimestampLabel(stream.activatedAt, language)
                : "--"
          }
        />
        <MiniStat label={language.startsWith("zh") ? "准备状态" : "Readiness"} value={readinessLabel} />
        <MiniStat
          label={stream.planId > 0n ? "ServicePlan" : language.startsWith("zh") ? "Service ref" : "Service ref"}
          value={stream.planId > 0n ? `#${stream.planId.toString()}` : formatServiceRefLabel(stream.serviceRef, language)}
          mono
        />
      </div>

      {stream.planId > 0n || stream.serviceRef.toLowerCase() !== ZERO_HASH || stream.createdAt > 0n ? (
        <div className="mt-4 rounded-[20px] border border-black/8 bg-white/90 px-4 py-3 text-xs leading-6 text-black/54">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span>
              {language.startsWith("zh") ? "创建时间" : "Created"}: {formatTimestampLabel(stream.createdAt, language)}
            </span>
            {stream.activationDeadline > 0n ? (
              <span>
                {language.startsWith("zh") ? "激活截止" : "Activation deadline"}: {formatTimestampLabel(stream.activationDeadline, language)}
              </span>
            ) : null}
            {stream.serviceRef.toLowerCase() !== ZERO_HASH ? (
              <span>
                {language.startsWith("zh") ? "服务引用" : "Service ref"}: {formatServiceRefLabel(stream.serviceRef, language)}
              </span>
            ) : null}
            {stream.planId > 0n ? (
              <span>
                {language.startsWith("zh") ? "套餐条款哈希" : "Plan terms"}: {formatServiceRefLabel(stream.planTermsHash, language)}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canWithdraw ? (
          <MiniAction
            label={pendingAction === "withdraw" ? t("streams.withdrawing") : t("streams.withdraw")}
            onClick={() => void onWithdraw(stream.streamId)}
            disabled={pendingAction === "withdraw" || actionsDisabled}
            primary
          />
        ) : null}
        {canPause ? (
          <MiniAction
            label={pendingAction === "pause" ? t("streams.pausing") : t("streams.pause")}
            onClick={() => void onPause(stream.streamId)}
            disabled={pendingAction === "pause" || actionsDisabled}
          />
        ) : null}
        {canResume ? (
          <MiniAction
            label={pendingAction === "resume" ? t("streams.resuming") : t("streams.resume")}
            onClick={() => void onResume(stream.streamId)}
            disabled={pendingAction === "resume" || actionsDisabled}
          />
        ) : null}
        {canCancel ? (
          <MiniAction
            label={pendingAction === "cancel" ? t("streams.canceling") : t("streams.cancel")}
            onClick={() => void onCancel(stream.streamId)}
            disabled={pendingAction === "cancel" || actionsDisabled}
          />
        ) : null}
        {canConfirmSender ? (
          <MiniAction
            label={language.startsWith("zh") ? "付款方确认" : "Confirm sender"}
            onClick={() => void onConfirmSender(stream.streamId)}
            disabled={pendingAction === "confirmSender" || actionsDisabled}
            title={actionsDisabled ? disabledReason : undefined}
          />
        ) : null}
        {canConfirmReceiver ? (
          <MiniAction
            label={language.startsWith("zh") ? "收款方确认" : "Confirm receiver"}
            onClick={() => void onConfirmReceiver(stream.streamId)}
            disabled={pendingAction === "confirmReceiver" || actionsDisabled}
            title={actionsDisabled ? disabledReason : undefined}
          />
        ) : null}
        {canActivate ? (
          <MiniAction
            label={language.startsWith("zh") ? "激活流" : "Activate"}
            onClick={() => void onActivate(stream.streamId)}
            disabled={pendingAction === "activate" || actionsDisabled}
            primary
            title={actionsDisabled ? disabledReason : undefined}
          />
        ) : null}
        {canCancelPending ? (
          <MiniAction
            label={language.startsWith("zh") ? "激活前取消" : "Cancel before activation"}
            onClick={() => void onCancelPending(stream.streamId)}
            disabled={pendingAction === "cancelPending" || actionsDisabled}
            title={actionsDisabled ? disabledReason : undefined}
          />
        ) : null}
      </div>

      {stream.failedNotifies.length > 0 ? (
        <div className="mt-4 space-y-2">
          {stream.failedNotifies.slice(0, 2).map((item) => (
            <RetryRow
              key={`${stream.streamId.toString()}-${item.withdrawId.toString()}`}
              stream={stream}
              item={item}
              language={language}
              retrying={Boolean(retryingNotifyKeys[`${stream.streamId.toString()}-${item.withdrawId.toString()}`])}
              actionsDisabled={actionsDisabled}
              disabledReason={disabledReason}
              onRetryNotify={onRetryNotify}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RetryRow({
  stream,
  item,
  language,
  retrying,
  actionsDisabled,
  disabledReason,
  onRetryNotify,
}: {
  stream: StreamCardData;
  item: NotifyFailureItem;
  language: string;
  retrying: boolean;
  actionsDisabled: boolean;
  disabledReason: string;
  onRetryNotify: (streamId: bigint, withdrawId: bigint) => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-[18px] border border-[#ffd0e1] bg-[#fff2f7] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-black">
            {t("streams.withdrawAttempts", { id: item.withdrawId.toString(), count: item.attempts })}
          </p>
          <p className="mt-1 text-xs text-black/46">
            {language.startsWith("zh") ? "最近尝试" : "Last attempt"} {new Date(Number(item.lastAttemptAt) * 1000).toLocaleString(language)}
          </p>
        </div>

        <MiniAction
          label={retrying ? t("streams.retrying") : t("streams.retryNotify")}
          onClick={() => void onRetryNotify(stream.streamId, item.withdrawId)}
          disabled={retrying || actionsDisabled}
          primary
          title={actionsDisabled ? disabledReason : ""}
        />
      </div>
    </div>
  );
}

function SheetShell({
  children,
  onClose,
  wide = false,
  centered = false,
}: {
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  centered?: boolean;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex bg-[rgba(16,17,19,0.18)] p-3 sm:p-5 ${
        centered ? "items-center justify-center" : "justify-end"
      }`}
      onClick={onClose}
    >
      <div
        className={`w-full overflow-y-auto rounded-[32px] border border-black/8 bg-[#fffbfd] shadow-[0_36px_100px_rgba(16,17,19,0.18)] ${
          wide
            ? "h-full max-w-[1080px]"
            : centered
              ? "max-h-[min(880px,calc(100vh-2rem))] max-w-[920px]"
              : "h-full max-w-[760px]"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-4 sm:p-5 lg:p-6">{children}</div>
      </div>
    </div>
  );
}

function SheetHeader({
  eyebrow,
  title,
  description,
  onClose,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-[12px] font-semibold tracking-[0.16em] text-black/40">{eyebrow}</p> : null}
        <h2 className="mt-2 font-display text-[2rem] font-semibold tracking-[-0.06em] text-black">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-black/60">{description}</p>
      </div>
      <button
        onClick={onClose}
        className="inline-flex size-10 items-center justify-center rounded-full border border-black/8 bg-white text-black/60 transition hover:border-black/14 hover:text-black"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-black/86">{label}</span>
      <div className="mt-2">{children}</div>
      {hint ? <span className="mt-2 block text-xs text-black/42">{hint}</span> : null}
    </label>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-[20px] border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-[#b8e0c9] bg-[#eff9f2] text-[#275d39]"
          : "border-[#ffd0e1] bg-[#fff2f7] text-[#b53b78]"
      }`}
    >
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/8 bg-white/92 p-4 shadow-[0_16px_40px_rgba(16,17,19,0.04)]">
      <p className="text-[12px] font-semibold tracking-[0.16em] text-black/38">{label}</p>
      <p className="mt-3 font-display text-[1.9rem] font-semibold tracking-[-0.06em] text-black">{value}</p>
      {detail ? <p className="mt-2 text-xs leading-6 text-black/46">{detail}</p> : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-black/8 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-black/36">{label}</p>
      <p className={`mt-2 text-sm text-black ${mono ? "font-mono-ui text-xs" : "font-medium"}`}>{value}</p>
    </div>
  );
}

function StatusPill({
  label,
  ok,
}: {
  label: string;
  ok: boolean | null;
}) {
  const className =
    ok === true
      ? "border-[#b8e0c9] bg-[#eff9f2] text-[#275d39]"
      : ok === false
        ? "border-[#ffd0e1] bg-[#fff2f7] text-[#b53b78]"
        : "border-black/8 bg-white text-black/42";

  return (
    <span className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${className}`}>{label}</span>
  );
}

function MiniAction({
  label,
  onClick,
  disabled,
  primary = false,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex min-h-10 items-center rounded-full px-3.5 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? "bg-[#101113] text-white hover:bg-black"
          : "border border-black/10 bg-white text-black/68 hover:border-black/16 hover:text-black"
      }`}
    >
      {label}
    </button>
  );
}
