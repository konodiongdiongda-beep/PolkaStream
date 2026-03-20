import { ExternalLink } from "lucide-react";
import type { Address } from "viem";

import { shortAddress } from "../hooks/usePolkaStream";
import { useI18n } from "../i18n";
import type { SettlementRow, SettlementServiceState, StreamCardData } from "../types";

type SettlementsProps = {
  account: string | null;
  settlements: SettlementRow[];
  streams: StreamCardData[];
  failedNotifyCount: number;
  settlementState: SettlementServiceState;
  tokenOptions: Array<{ address: Address; symbol: string }>;
  selectedToken: Address | null;
  onSelectToken: (value: Address) => void;
  onRefresh: () => Promise<void>;
};

const formatWindowLabel = (start: number, end: number, locale: string) => {
  const startLabel = new Date(start * 1000).toLocaleString(locale);
  const endLabel = new Date(end * 1000).toLocaleTimeString(locale);
  return `${startLabel} -> ${endLabel}`;
};

const compactValue = (value: string) => {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

export default function Settlements({
  account,
  settlements,
  streams,
  failedNotifyCount,
  settlementState,
  tokenOptions,
  selectedToken,
  onSelectToken,
  onRefresh,
}: SettlementsProps) {
  const { t, language } = useI18n();
  const metrics = settlementState.metrics;
  const lastSyncedLabel = settlementState.lastSyncedAt
    ? new Date(settlementState.lastSyncedAt).toLocaleTimeString(language)
    : "--";
  const authMode = settlementState.config?.auth?.requireAuth;
  const streamRetryLinkCount = streams.reduce((acc, item) => acc + item.failedNotifies.length, 0);
  const currentTokenLabel =
    tokenOptions.find((item) => item.address.toLowerCase() === selectedToken?.toLowerCase())?.symbol ?? t("common.token");
  const authStatus =
    authMode === undefined
      ? "--"
      : authMode
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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="space-y-4">
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.12fr)_320px]">
          <section className="panel p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="eyebrow">{t("settlements.heroEyebrow")}</p>
                <h3 className="mt-2 font-display text-[1.45rem] font-semibold tracking-[-0.04em] text-white">
                  {t("settlements.heroTitle")}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{t("settlements.heroBody")}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:max-w-[320px] lg:justify-end">
                <div className="w-full lg:w-[210px]">
                  <label className="eyebrow">{t("common.selectedToken")}</label>
                  <select
                    value={selectedToken ?? ""}
                    onChange={(event) => onSelectToken(event.target.value as Address)}
                    className="input-shell mt-2"
                  >
                    {tokenOptions.length === 0 ? (
                      <option value="">{t("common.noTokenDetected")}</option>
                    ) : (
                      tokenOptions.map((token) => (
                        <option key={token.address} value={token.address} className="bg-[#10161f]">
                          {token.symbol}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3 lg:self-end">
                  <p className="eyebrow">{t("dashboard.metric.synced")}</p>
                  <p className="mt-2 font-mono-ui text-xs text-slate-200">{lastSyncedLabel}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label={t("dashboard.metric.requestEvents")}
                value={metrics ? metrics.requestEvents : "--"}
                detail={t("settlements.metric.requestEventsDetail")}
              />
              <SummaryCard
                label={t("dashboard.metric.batchedWindows")}
                value={metrics ? metrics.batchedWindows : "--"}
                detail={t("settlements.metric.batchedWindowsDetail")}
              />
              <SummaryCard
                label={t("settlements.providerClaimable")}
                value={settlementState.providerClaimable !== null ? settlementState.providerClaimable.toString() : "--"}
                detail={t("settlements.providerClaimableDetail", { token: currentTokenLabel })}
              />
              <SummaryCard
                label={t("streams.stat.retryQueue")}
                value={failedNotifyCount}
                detail={t("streams.stat.retryQueueDetail")}
              />
            </div>
          </section>

          <section className="panel-muted p-5">
            <p className="eyebrow">{t("settlements.liveEyebrow")}</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("settlements.liveTitle")}</h3>

            <div className="mt-4 space-y-2.5 text-sm">
              <StatusRow label={t("common.api")} value={settlementState.apiReachable ? t("common.reachable") : t("common.offline")} />
              <StatusRow label={t("common.auth")} value={authStatus} />
              <StatusRow
                label={t("common.hub")}
                value={settlementState.hubAddress ? shortAddress(settlementState.hubAddress) : t("common.notConfigured")}
                mono={Boolean(settlementState.hubAddress)}
              />
              <StatusRow
                label={t("settlements.windowSeconds")}
                value={
                  settlementState.config?.settlementWindowSeconds
                    ? `${settlementState.config.settlementWindowSeconds}s`
                    : "--"
                }
              />
              <StatusRow label={t("dashboard.allowlistLabel", { token: currentTokenLabel })} value={allowlistStatus} />
              <StatusRow label={t("dashboard.metric.txReduction")} value={metrics ? `${metrics.txReductionPct}%` : "--"} />
              <StatusRow
                label={t("dashboard.metric.avgLatency")}
                value={metrics ? `${metrics.avgAggregationLatencySeconds}s` : "--"}
              />
              <StatusRow label={t("dashboard.metric.synced")} value={lastSyncedLabel} mono />
            </div>

            <div className="mt-4 rounded-[20px] border border-orange-400/18 bg-orange-400/10 p-4 text-sm text-orange-100">
              {t("settlements.failedNotifyRail", { count: failedNotifyCount })}
            </div>

            {settlementState.apiError ? (
              <p className="mt-4 text-sm leading-6 text-orange-100">{settlementState.apiError}</p>
            ) : null}
            {settlementState.metricsError ? (
              <p className="mt-2 text-sm leading-6 text-orange-100">{settlementState.metricsError}</p>
            ) : null}
          </section>
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="panel p-5">
              <p className="eyebrow">{t("settlements.hubReadsEyebrow")}</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("settlements.hubReadsTitle")}</h3>

              <div className="mt-5 grid gap-3">
                <BalanceCard
                  label={t("common.currentAccount")}
                  value={account ? shortAddress(account) : t("wallet.notConnected")}
                  detail={
                    account
                      ? t("settlements.currentAccountDetailConnected")
                      : t("settlements.currentAccountDetailDisconnected")
                  }
                />
                <BalanceCard
                  label={t("settlements.payerEscrow")}
                  value={settlementState.payerEscrow !== null ? settlementState.payerEscrow.toString() : "--"}
                  detail={t("settlements.payerEscrowDetail", { token: currentTokenLabel })}
                  mono
                />
                <BalanceCard
                  label={t("settlements.providerClaimable")}
                  value={settlementState.providerClaimable !== null ? settlementState.providerClaimable.toString() : "--"}
                  detail={t("settlements.providerClaimableDetail", { token: currentTokenLabel })}
                  mono
                />
              </div>

              {settlementState.hubReadError ? (
                <p className="mt-4 text-sm leading-6 text-orange-100">{settlementState.hubReadError}</p>
              ) : null}
            </section>

            <section className="panel-muted p-5">
              <p className="eyebrow">{t("settlements.boundariesEyebrow")}</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("settlements.boundariesTitle")}</h3>

              <div className="mt-4 space-y-3">
                <BoundaryCard
                  title={t("settlements.boundary.streamTitle")}
                  body={t("settlements.boundary.streamBody")}
                  metric={t("settlements.boundary.streamMetric", { count: streamRetryLinkCount })}
                />
                <BoundaryCard
                  title={t("settlements.boundary.serviceTitle")}
                  body={t("settlements.boundary.serviceBody")}
                  metric={t("settlements.boundary.serviceMetric", { count: settlementState.windows.length })}
                />
              </div>

              <div className="mt-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                <p className="font-medium text-white">{t("settlements.whyTitle")}</p>
                <p className="mt-2">{t("settlements.whyBody")}</p>
              </div>
            </section>
          </aside>

          <div className="space-y-4">
            <section className="panel overflow-hidden p-0">
              <div className="flex flex-col gap-2 border-b border-white/8 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow">{t("settlements.title")}</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("settlements.heroTitle")}</h3>
                </div>
                <span className="text-xs text-slate-500">{settlementState.apiBaseUrl}</span>
              </div>

              {settlements.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-300">{t("settlements.empty")}</div>
              ) : (
                <div className="divide-y divide-white/8">
                  {settlements.map((row) => (
                    <article
                      key={row.id}
                      className="grid gap-4 px-5 py-4 lg:grid-cols-[160px_140px_minmax(0,1fr)_120px] lg:items-start"
                    >
                      <div>
                        <p className="text-sm text-white">{row.date}</p>
                        <p className="mt-1 font-mono-ui text-xs text-slate-500">#{row.streamId}</p>
                      </div>

                      <div>
                        <p className="eyebrow">{t("settlements.recipient")}</p>
                        <p className="mt-2 font-mono-ui text-xs text-slate-200">{row.recipient}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                        <div>
                          <p className="eyebrow">{t("settlements.amount")}</p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {row.amount} {row.token}
                          </p>
                        </div>
                        <div>
                          <p className="eyebrow">{t("settlements.insight")}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{row.insight}</p>
                        </div>
                      </div>

                      <div className="lg:justify-self-end">
                        <StatusPill status={row.status} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel overflow-hidden p-0">
              <div className="border-b border-white/8 px-5 py-4">
                <p className="eyebrow">{t("settlements.auditEyebrow")}</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("settlements.auditTitle")}</h3>
              </div>

              {settlementState.windows.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-300">
                  {settlementState.windowsError ? settlementState.windowsError : t("settlements.auditEmpty")}
                </div>
              ) : (
                <div className="space-y-3 px-5 py-5">
                  {settlementState.windows.map((window) => (
                    <article key={window.windowId} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <p className="font-mono-ui text-xs text-white">{compactValue(window.windowId)}</p>
                          <div className="mt-1 inline-flex items-center gap-2 text-xs text-slate-500">
                            <ExternalLink className="size-3.5" />
                            <span>{t("settlements.table.daemonWindowId")}</span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-300">
                            {formatWindowLabel(window.windowStart, window.windowEnd, language)}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[360px]">
                          <AuditStat label={t("settlements.table.requests")} value={window.totalRequests} />
                          <AuditStat
                            label={t("settlements.table.amountWei")}
                            value={compactValue(window.totalAmountWei)}
                            mono
                          />
                          <AuditStat label={t("settlements.table.items")} value={window.items.length} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {window.items.slice(0, 2).map((item) => (
                          <div
                            key={`${item.payer}-${item.provider}-${item.token}`}
                            className="rounded-[18px] border border-white/8 bg-black/20 px-4 py-3"
                          >
                            <p className="font-mono-ui text-xs text-slate-100">
                              {shortAddress(item.payer)}
                              {" -> "}
                              {shortAddress(item.provider)}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">{compactValue(item.amountWei)} wei</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="panel-muted p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-[1.82rem] font-semibold tracking-[-0.05em] text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  detail,
  mono = false,
}: {
  label: string;
  value: string;
  detail: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 text-sm text-white ${mono ? "font-mono-ui text-xs leading-6" : "font-semibold"}`}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function StatusRow({
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

function StatusPill({ status }: { status: SettlementRow["status"] }) {
  const { t } = useI18n();
  const label =
    status === "FAILED"
      ? t("settlements.status.failed")
      : status === "RETRYING"
        ? t("settlements.status.retrying")
        : t("settlements.status.success");

  const className =
    status === "FAILED"
      ? "border-orange-300/24 bg-orange-400/10 text-orange-100"
      : status === "RETRYING"
        ? "border-cyan-300/24 bg-cyan-400/10 text-cyan-100"
        : "border-lime-300/24 bg-lime-400/10 text-lime-100";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] ${className}`}>
      {label}
    </span>
  );
}

function BoundaryCard({
  title,
  body,
  metric,
}: {
  title: string;
  body: string;
  metric: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
      <p className="mt-3 text-xs text-slate-500">{metric}</p>
    </div>
  );
}

function AuditStat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-black/20 px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 text-sm text-white ${mono ? "font-mono-ui text-xs" : "font-semibold"}`}>{value}</p>
    </div>
  );
}
