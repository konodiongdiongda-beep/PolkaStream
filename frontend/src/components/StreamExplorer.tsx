import { AlertCircle, Pause, Play, Wallet, XCircle } from "lucide-react";
import { formatUnits } from "viem";

import { shortAddress } from "../hooks/usePolkaStream";
import { useI18n } from "../i18n";
import type { ActionType, StreamCardData } from "../types";

type StreamExplorerProps = {
  streams: StreamCardData[];
  pendingActions: Record<string, ActionType | null>;
  retryingNotifyKeys: Record<string, boolean>;
  actionsDisabled: boolean;
  disabledReason: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  onWithdraw: (streamId: bigint) => Promise<void>;
  onPause: (streamId: bigint) => Promise<void>;
  onResume: (streamId: bigint) => Promise<void>;
  onCancel: (streamId: bigint) => Promise<void>;
  onRetryNotify: (streamId: bigint, withdrawId: bigint) => Promise<void>;
};

const formatAmount = (amount: bigint, decimals: number) =>
  Number.parseFloat(formatUnits(amount, decimals)).toFixed(4);

const formatTimestamp = (value: bigint, locale: string) => {
  if (value <= 0n) return "--";
  return new Date(Number(value) * 1000).toLocaleString(locale);
};

const formatDuration = (
  value: bigint,
  t: (key: string, vars?: Record<string, string | number>) => string
) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";
  if (seconds % 86400 === 0) return t("time.dayCompact", { count: seconds / 86400 });
  if (seconds % 3600 === 0) return t("time.hourCompact", { count: seconds / 3600 });
  if (seconds % 60 === 0) return t("time.minuteCompact", { count: seconds / 60 });
  return t("time.secondCompact", { count: seconds });
};

export default function StreamExplorer({
  streams,
  pendingActions,
  retryingNotifyKeys,
  actionsDisabled,
  disabledReason,
  isRefreshing,
  onRefresh,
  onWithdraw,
  onPause,
  onResume,
  onCancel,
  onRetryNotify,
}: StreamExplorerProps) {
  const { t, language } = useI18n();
  const activeCount = streams.filter((item) => item.status === "active" || item.status === "completed").length;
  const claimableTotal = streams
    .filter((item) => item.role === "receiver")
    .reduce((acc, item) => acc + Number.parseFloat(formatUnits(item.owed, item.tokenDecimals)), 0);
  const retryQueue = streams.reduce((acc, item) => acc + item.failedNotifies.length, 0);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="space-y-4">
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="panel p-5">
            <p className="eyebrow">{t("streams.heroEyebrow")}</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("app.page.streams.title")}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{t("streams.heroBody")}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatCard
                label={t("dashboard.metric.activeStreams")}
                value={activeCount}
                detail={t("streams.stat.activeDetail")}
              />
              <StatCard
                label={t("streams.stat.claimable")}
                value={claimableTotal.toFixed(2)}
                detail={t("streams.stat.claimableDetail")}
              />
              <StatCard label={t("streams.stat.retryQueue")} value={retryQueue} detail={t("streams.stat.retryQueueDetail")} />
            </div>
          </section>

          <section className="panel-muted p-5">
            <p className="eyebrow">{t("streams.retryEyebrow")}</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("streams.retryTitle")}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {retryQueue > 0 ? t("streams.retryBodyHasItems") : t("streams.retryBodyEmpty")}
            </p>

            <div className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="eyebrow">{t("header.refresh")}</p>
              <p className="mt-2 text-sm text-slate-300">{isRefreshing ? t("streams.refreshing") : t("app.page.streams.description")}</p>
            </div>
          </section>
        </section>

        {actionsDisabled ? (
          <div className="rounded-[22px] border border-orange-400/18 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">
            {disabledReason}
          </div>
        ) : null}

        {streams.length === 0 ? (
          <div className="panel p-8 text-sm text-slate-300">{t("streams.empty")}</div>
        ) : (
          <div className="space-y-4">
            {streams.map((stream) => {
              const pending = pendingActions[stream.streamId.toString()] ?? null;
              const progress =
                stream.deposit === 0n
                  ? 0
                  : Math.min(100, Number(((stream.withdrawnAmount + stream.owed) * 10000n) / stream.deposit) / 100);

              const canWithdraw =
                stream.role === "receiver" &&
                (stream.status === "active" || stream.status === "paused" || stream.status === "completed") &&
                stream.owed > 0n;
              const canPause = stream.role === "sender" && stream.status === "active";
              const canResume = stream.role === "sender" && stream.status === "paused";
              const canCancel = stream.role === "sender" && (stream.status === "active" || stream.status === "paused");
              const cardTone = stream.failedNotifies.length > 0
                ? "border-orange-300/18"
                : stream.status === "canceled" || stream.status === "expired"
                  ? "border-white/10"
                  : stream.status === "paused"
                    ? "border-orange-300/12"
                    : stream.status === "pending"
                      ? "border-sky-300/12"
                    : "border-cyan-300/12";
              const statusLabel =
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
              const statusClass =
                stream.status === "canceled" || stream.status === "expired"
                  ? "border border-slate-500/30 bg-slate-500/12 text-slate-200"
                  : stream.status === "paused"
                    ? "border border-orange-400/25 bg-orange-400/12 text-orange-100"
                    : stream.status === "pending"
                      ? "border border-sky-400/25 bg-sky-400/12 text-sky-100"
                      : stream.status === "completed"
                        ? "border border-lime-300/25 bg-lime-400/10 text-lime-100"
                        : "border border-lime-300/25 bg-lime-400/10 text-lime-100";

              return (
                <article key={stream.streamId.toString()} className={`panel overflow-hidden border ${cardTone} p-0`}>
                  <div className="border-b border-white/8 px-5 py-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="eyebrow">{t("streams.streamLabel", { id: stream.streamId.toString() })}</span>
                          <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                            {stream.tokenSymbol}
                          </span>
                          <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                            {stream.role === "sender" ? t("streams.sender") : t("streams.receiver")}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          <span className="font-mono-ui text-xs text-slate-400">{shortAddress(stream.sender)}</span>
                          {" -> "}
                          <span className="font-mono-ui text-xs text-slate-400">{shortAddress(stream.receiver)}</span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClass}`}>
                          {statusLabel}
                        </span>

                        {canWithdraw ? (
                          <button
                            onClick={() => void onWithdraw(stream.streamId)}
                            disabled={pending === "withdraw" || actionsDisabled}
                            title={actionsDisabled ? disabledReason : ""}
                            className="inline-flex items-center gap-2 rounded-[16px] border border-lime-300/24 bg-lime-400/12 px-4 py-2.5 text-sm font-medium text-lime-50 transition hover:bg-lime-400/18 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Wallet className="size-4" />
                            {pending === "withdraw" ? t("streams.withdrawing") : t("streams.withdraw")}
                          </button>
                        ) : null}

                        {canPause ? (
                          <button
                            onClick={() => void onPause(stream.streamId)}
                            disabled={pending === "pause" || actionsDisabled}
                            title={actionsDisabled ? disabledReason : ""}
                            className="button-secondary inline-flex items-center gap-2"
                          >
                            <Pause className="size-4" />
                            {pending === "pause" ? t("streams.pausing") : t("streams.pause")}
                          </button>
                        ) : null}

                        {canResume ? (
                          <button
                            onClick={() => void onResume(stream.streamId)}
                            disabled={pending === "resume" || actionsDisabled}
                            title={actionsDisabled ? disabledReason : ""}
                            className="button-primary inline-flex items-center gap-2"
                          >
                            <Play className="size-4" />
                            {pending === "resume" ? t("streams.resuming") : t("streams.resume")}
                          </button>
                        ) : null}

                        {canCancel ? (
                          <button
                            onClick={() => void onCancel(stream.streamId)}
                            disabled={pending === "cancel" || actionsDisabled}
                            title={actionsDisabled ? disabledReason : ""}
                            className="inline-flex items-center gap-2 rounded-[16px] border border-slate-400/20 bg-slate-500/10 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <XCircle className="size-4" />
                            {pending === "cancel" ? t("streams.canceling") : t("streams.cancel")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                      <DataPoint label={t("streams.deposit")} value={`${formatAmount(stream.deposit, stream.tokenDecimals)} ${stream.tokenSymbol}`} />
                      <DataPoint label={t("streams.claimable")} value={`${formatAmount(stream.owed, stream.tokenDecimals)} ${stream.tokenSymbol}`} />
                      <DataPoint label={t("streams.withdrawn")} value={`${formatAmount(stream.withdrawnAmount, stream.tokenDecimals)} ${stream.tokenSymbol}`} />
                      <DataPoint label={t("common.duration")} value={formatDuration(stream.durationInSeconds, t)} />
                      <DataPoint label={t("streams.started")} value={formatTimestamp(stream.startTime, language)} mono />
                      <DataPoint label={t("streams.cliffEnds")} value={formatTimestamp(stream.cliffEndsAt, language)} mono />
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        <span>{t("streams.fundingProgress")}</span>
                        <span className="font-mono-ui text-slate-300">{progress.toFixed(2)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {stream.failedNotifies.length > 0 ? (
                      <div className="mt-5 rounded-[20px] border border-orange-400/20 bg-orange-400/10 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="eyebrow text-orange-100">{t("streams.retryRequired")}</p>
                            <p className="mt-1 text-sm font-semibold text-white">{t("streams.failedNotifyRecords")}</p>
                          </div>
                          <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-2.5 py-1 text-[11px] font-medium tracking-[0.01em] text-orange-100">
                            {t("streams.failedItems", { count: stream.failedNotifies.length })}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2">
                          {stream.failedNotifies.map((item) => {
                            const key = `${stream.streamId.toString()}-${item.withdrawId.toString()}`;
                            const retrying = Boolean(retryingNotifyKeys[key]);

                            return (
                              <div key={key} className="rounded-[16px] border border-white/10 bg-[rgba(8,12,19,0.35)] px-4 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {t("streams.withdrawAttempts", {
                                        id: item.withdrawId.toString(),
                                        count: item.attempts,
                                      })}
                                    </p>
                                    <p className="mt-1 text-xs text-orange-100">
                                      {t("streams.lastAttempt", { time: formatTimestamp(item.lastAttemptAt, language) })}
                                    </p>
                                  </div>

                                  <button
                                    onClick={() => void onRetryNotify(stream.streamId, item.withdrawId)}
                                    disabled={retrying || actionsDisabled}
                                    className="inline-flex items-center gap-2 rounded-[14px] border border-orange-300/25 bg-orange-300/10 px-3 py-2 text-xs font-medium text-orange-50 transition hover:bg-orange-300/16 disabled:cursor-not-allowed disabled:opacity-50"
                                    title={actionsDisabled ? disabledReason : ""}
                                  >
                                    {retrying ? t("streams.retrying") : t("streams.retryNotify")}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {actionsDisabled && (canWithdraw || canPause || canResume || canCancel) ? (
                      <p className="mt-3 inline-flex items-center gap-2 text-sm text-orange-100">
                        <AlertCircle className="size-4" />
                        {disabledReason}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-[1.82rem] font-semibold tracking-[-0.05em] text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function DataPoint({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-3 text-sm text-white ${mono ? "font-mono-ui text-xs leading-6" : "font-medium"}`}>{value}</p>
    </div>
  );
}
