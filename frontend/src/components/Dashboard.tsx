import { CheckCircle2, CircleAlert, Loader2, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { shortAddress } from "../hooks/usePolkaStream";
import { useI18n } from "../i18n";
import type { ActivityItem, PreflightState, SettlementServiceState } from "../types";

type DashboardProps = {
  account: string | null;
  walletName: string;
  walletChainId: number | null;
  notice: string;
  userError: string;
  preflight: PreflightState;
  isPreflightChecking: boolean;
  dashboardStats: {
    activeCount: number;
    pausedCount: number;
    canceledCount: number;
    failedNotifyCount: number;
    totalOwed: number;
  };
  recentActivities: ActivityItem[];
  settlementState: SettlementServiceState;
  selectedTokenSymbol: string;
};

export default function Dashboard({
  account,
  walletName,
  walletChainId,
  notice,
  userError,
  preflight,
  isPreflightChecking,
  dashboardStats,
  recentActivities,
  settlementState,
  selectedTokenSymbol,
}: DashboardProps) {
  const { t } = useI18n();
  const metrics = settlementState.metrics;
  const syncedLabel = settlementState.lastSyncedAt
    ? new Date(settlementState.lastSyncedAt).toLocaleTimeString()
    : "--";
  const flowSteps = [
    t("dashboard.flow.connect"),
    t("dashboard.flow.fund"),
    t("dashboard.flow.submit"),
    t("dashboard.flow.claim"),
  ];
  const preflightChecks = [
    { label: t("dashboard.preflight.chain"), ok: preflight.chainOk },
    { label: t("dashboard.preflight.contract"), ok: preflight.contractOk },
    { label: t("dashboard.preflight.notifier"), ok: preflight.notifierOk },
    {
      label: t("dashboard.preflight.tokenAllowlist"),
      ok: preflight.tokenAllowed === null ? null : preflight.tokenAllowed,
    },
  ];
  const readyChecks = preflightChecks.filter((item) => item.ok === true).length;
  const authRequired = settlementState.config?.auth?.requireAuth;
  const authStatus =
    authRequired === undefined
      ? "--"
      : authRequired
        ? settlementState.authProvided
          ? t("common.requiredTokenProvided")
          : t("common.requiredTokenMissing")
        : t("common.public");
  const allowlistStatus =
    settlementState.tokenAllowed === null
      ? "--"
      : settlementState.tokenAllowed
        ? t("common.allowed")
        : t("common.blocked");
  const walletTitle = account ? shortAddress(account) : t("wallet.notConnected");
  const walletDetail = account
    ? t("dashboard.walletDetailConnected", { wallet: walletName || t("wallet.unknown"), chainId: walletChainId ?? "-" })
    : t("dashboard.walletDetailDisconnected");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="space-y-4">
        {notice ? (
          <div className="rounded-[22px] border border-blue-300/18 bg-blue-400/10 px-4 py-3 text-sm text-blue-50">
            {notice}
          </div>
        ) : null}
        {userError ? (
          <div className="rounded-[22px] border border-orange-400/18 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">
            {userError}
          </div>
        ) : null}

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.16fr)_340px]">
          <div className="space-y-4">
            <section className="panel p-5 sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <p className="eyebrow">{t("dashboard.usecase.agent.title")}</p>
                  <h3 className="mt-2 font-display text-[1.45rem] font-semibold tracking-[-0.04em] text-white sm:text-[1.68rem]">
                    {t("dashboard.coreStoryTitle")}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{t("dashboard.coreStoryBody")}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:w-[340px]">
                  <SignalCard label={t("common.token")} value={selectedTokenSymbol} tone="default" />
                  <SignalCard
                    label={t("common.api")}
                    value={settlementState.apiReachable ? t("common.reachable") : t("common.offline")}
                    tone={settlementState.apiReachable ? "cyan" : "muted"}
                  />
                  <SignalCard
                    label={t("common.hub")}
                    value={settlementState.hubAddress ? shortAddress(settlementState.hubAddress) : t("common.missing")}
                    tone={settlementState.hubAddress ? "default" : "muted"}
                  />
                  <SignalCard
                    label={t("dashboard.metric.txReduction")}
                    value={metrics ? `${metrics.txReductionPct}%` : "--"}
                    tone="cyan"
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-2 md:grid-cols-4">
                {flowSteps.map((step, index) => (
                  <FlowStep key={step} index={index + 1} label={step} />
                ))}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={t("dashboard.metric.activeStreams")}
                value={dashboardStats.activeCount}
                detail={t("dashboard.metric.activeStreamsDetail")}
              />
              <MetricCard
                label={t("dashboard.metric.failedNotify")}
                value={dashboardStats.failedNotifyCount}
                detail={t("dashboard.metric.failedNotifyDetail")}
              />
              <MetricCard
                label={t("dashboard.metric.batchedWindows")}
                value={metrics ? metrics.batchedWindows : "--"}
                detail={t("dashboard.metric.batchedWindowsDetail")}
              />
              <MetricCard
                label={t("dashboard.metric.requestEvents")}
                value={metrics ? metrics.requestEvents : "--"}
                detail={t("dashboard.metric.requestEventsDetail")}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <section className="panel p-5">
                <p className="eyebrow">{t("dashboard.recentActivityEyebrow")}</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("dashboard.recentActivityTitle")}</h3>

                <div className="mt-4 flex items-center justify-between rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm">
                  <span className="text-slate-400">{t("dashboard.metric.synced")}</span>
                  <span className="font-mono-ui text-xs text-slate-200">{syncedLabel}</span>
                </div>

                <div className="mt-4 space-y-3">
                  {recentActivities.length === 0 ? (
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
                      {t("dashboard.recentActivityEmpty")}
                    </div>
                  ) : (
                    recentActivities.map((item) => (
                      <div key={item.id} className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-1.5 size-2 rounded-full ${
                                item.level === "success"
                                  ? "bg-lime-300"
                                  : item.level === "warning"
                                    ? "bg-orange-300"
                                    : "bg-slate-400"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium text-white">{item.title}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-300">{item.description}</p>
                            </div>
                          </div>
                          <span className="font-mono-ui text-[11px] uppercase tracking-[0.16em] text-slate-500">
                            {item.timestampLabel}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="panel-muted p-5">
                <p className="eyebrow">{t("dashboard.hubEyebrow")}</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("dashboard.hubTitle")}</h3>

                <div className="mt-4 space-y-3">
                  <ReasonCard title={t("dashboard.hubReason.1.title")} body={t("dashboard.hubReason.1.body")} index={1} />
                  <ReasonCard title={t("dashboard.hubReason.2.title")} body={t("dashboard.hubReason.2.body")} index={2} />
                  <ReasonCard title={t("dashboard.hubReason.3.title")} body={t("dashboard.hubReason.3.body")} index={3} />
                </div>
              </section>
            </section>
          </div>

          <div className="space-y-4">
            <section className="panel-muted p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">{t("dashboard.statusPanelEyebrow")}</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("dashboard.statusPanelTitle")}</h3>
                </div>
                {isPreflightChecking ? <Loader2 className="size-4 animate-spin text-cyan-200" /> : null}
              </div>

              <div className="mt-5 space-y-4">
                <InfoCard icon={Wallet} label={t("common.wallet")} title={walletTitle} detail={walletDetail} />

                <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="eyebrow">{t("common.preflight")}</p>
                    <span className="font-mono-ui text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      {readyChecks}/{preflightChecks.length}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{preflight.reason}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {preflightChecks.map((item) => (
                      <CheckBadge key={item.label} label={item.label} ok={item.ok} />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="panel p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-10 items-center justify-center rounded-[14px] border border-cyan-300/18 bg-cyan-400/10 text-cyan-100">
                  <ShieldCheck className="size-4.5" />
                </div>
                <div>
                  <p className="eyebrow">{t("dashboard.serviceEyebrow")}</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("dashboard.serviceTitle")}</h3>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 text-sm">
                <SurfaceRow
                  label={t("common.api")}
                  value={settlementState.apiReachable ? t("common.reachable") : t("common.offline")}
                />
                <SurfaceRow
                  label={t("common.hub")}
                  value={settlementState.hubAddress ? shortAddress(settlementState.hubAddress) : t("common.notConfigured")}
                  mono={Boolean(settlementState.hubAddress)}
                />
                <SurfaceRow
                  label={t("common.window")}
                  value={
                    settlementState.config?.settlementWindowSeconds
                      ? `${settlementState.config.settlementWindowSeconds}s`
                      : "--"
                  }
                />
                <SurfaceRow label={t("common.auth")} value={authStatus} />
                <SurfaceRow label={t("dashboard.allowlistLabel", { token: selectedTokenSymbol })} value={allowlistStatus} />
                <SurfaceRow
                  label={t("dashboard.metric.avgLatency")}
                  value={metrics ? `${metrics.avgAggregationLatencySeconds}s` : "--"}
                />
              </div>

              {settlementState.apiError ? (
                <p className="mt-4 text-sm leading-6 text-orange-100">{settlementState.apiError}</p>
              ) : null}
              {settlementState.metricsError ? (
                <p className="mt-2 text-sm leading-6 text-orange-100">{settlementState.metricsError}</p>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}

function SignalCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "default" | "cyan" | "muted";
}) {
  const valueClass =
    tone === "cyan" ? "text-cyan-100" : tone === "muted" ? "text-slate-500" : "text-white";

  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3.5">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

function FlowStep({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
      <span className="inline-flex size-7 items-center justify-center rounded-full border border-white/8 bg-white/[0.05] font-mono-ui text-[11px] text-slate-300">
        {String(index).padStart(2, "0")}
      </span>
      <p className="text-sm font-medium text-white">{label}</p>
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
  detail: string;
}) {
  return (
    <div className="panel-muted p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-[1.85rem] font-semibold tracking-[-0.05em] text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function ReasonCard({
  title,
  body,
  index,
}: {
  title: string;
  body: string;
  index: number;
}) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 items-center justify-center rounded-full border border-white/8 bg-white/[0.05] font-mono-ui text-[11px] text-slate-300">
          {String(index).padStart(2, "0")}
        </span>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  title,
  detail,
  children,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-10 items-center justify-center rounded-[14px] border border-white/8 bg-white/[0.05] text-slate-200">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{label}</p>
          <p className="mt-2 break-all text-sm font-semibold text-white">{title}</p>
          {detail ? <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p> : null}
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

function CheckBadge({ label, ok }: { label: string; ok: boolean | null }) {
  const toneClass =
    ok === true
      ? "border-lime-300/24 bg-lime-400/10 text-lime-100"
      : ok === false
        ? "border-orange-300/24 bg-orange-400/10 text-orange-100"
        : "border-white/8 bg-white/[0.04] text-slate-400";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium ${toneClass}`}>
      {ok === true ? <CheckCircle2 className="size-3.5" /> : ok === false ? <CircleAlert className="size-3.5" /> : null}
      <span>{label}</span>
    </span>
  );
}

function SurfaceRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3">
      <span className="text-slate-400">{label}</span>
      <span className={mono ? "font-mono-ui text-xs text-slate-100" : "text-right text-slate-100"}>{value}</span>
    </div>
  );
}
