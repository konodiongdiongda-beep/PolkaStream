import { CheckCircle2, Loader2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { isAddress } from "viem";

import { shortAddress } from "../hooks/usePolkaStream";
import { useI18n } from "../i18n";
import { polkadotHubTestnet } from "../lib/viem";
import type { PreflightState, PresetToken } from "../types";

type CreateStreamProps = {
  account: string | null;
  form: {
    receiver: string;
    token: string;
    deposit: string;
    durationSeconds: string;
    cliffSeconds: string;
  };
  setForm: Dispatch<
    SetStateAction<{
      receiver: string;
      token: string;
      deposit: string;
      durationSeconds: string;
      cliffSeconds: string;
    }>
  >;
  presetTokens: PresetToken[];
  preflight: PreflightState;
  isPreflightChecking: boolean;
  createDisabled: boolean;
  createDisabledReason: string;
  isCreating: boolean;
  notice: string;
  userError: string;
  onCreate: () => Promise<void>;
};

const statusLabel = (
  t: (key: string, vars?: Record<string, string | number>) => string,
  ok: boolean | null
) => {
  if (ok === null) return t("status.pending");
  return ok ? t("status.ok") : t("status.fail");
};

const formatDurationLabel = (
  raw: string,
  t: (key: string, vars?: Record<string, string | number>) => string
) => {
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";

  if (seconds % 86400 === 0) return t("time.dayCompact", { count: seconds / 86400 });
  if (seconds % 3600 === 0) return t("time.hourCompact", { count: seconds / 3600 });
  if (seconds % 60 === 0) return t("time.minuteCompact", { count: seconds / 60 });
  return t("time.secondCompact", { count: seconds });
};

export default function CreateStream({
  account,
  form,
  setForm,
  presetTokens,
  preflight,
  isPreflightChecking,
  createDisabled,
  createDisabledReason,
  isCreating,
  notice,
  userError,
  onCreate,
}: CreateStreamProps) {
  const { t } = useI18n();
  const tokenLooksValid = isAddress(form.token);
  const selectedPreset = presetTokens.find((preset) => preset.address.toLowerCase() === form.token.toLowerCase());
  const summaryRows = [
    { label: t("streams.sender"), value: account ? shortAddress(account) : t("create.connectWalletShort"), mono: true },
    { label: t("streams.receiver"), value: form.receiver || "--", mono: Boolean(form.receiver) },
    { label: t("common.token"), value: selectedPreset?.symbol ?? (form.token || "--"), mono: !selectedPreset },
    { label: t("streams.deposit"), value: form.deposit || "--" },
    { label: t("common.duration"), value: formatDurationLabel(form.durationSeconds, t) },
    { label: t("common.cliff"), value: t("time.secondCompact", { count: form.cliffSeconds || "0" }) },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="space-y-4">
        {notice ? (
          <p className="rounded-[22px] border border-emerald-400/18 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {notice}
          </p>
        ) : null}
        {userError ? (
          <p className="rounded-[22px] border border-orange-400/18 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">
            {userError}
          </p>
        ) : null}

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.12fr)_340px]">
          <section className="panel p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <p className="eyebrow">{t("create.heroEyebrow")}</p>
                <h3 className="mt-2 font-display text-[1.42rem] font-semibold tracking-[-0.04em] text-white">
                  {t("app.page.create.title")}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{t("create.heroBody")}</p>
              </div>

              <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 xl:w-[300px]">
                <p className="eyebrow">{t("create.helperTitle")}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t("create.helperBody")}</p>
                <div className="mt-4 grid gap-2 text-xs text-slate-400">
                  <p>{t("create.helperNetwork", { value: polkadotHubTestnet.name })}</p>
                  <p>
                    {t("create.helperTokenValidity", {
                      value: tokenLooksValid ? t("create.tokenValidityValid") : t("create.tokenValidityInvalid"),
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <section className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <p className="eyebrow">{t("streams.sender")}</p>
                    <div className="input-shell mt-2 flex min-h-12 items-center">
                      <span className="font-mono-ui text-xs text-slate-100">
                        {account ? shortAddress(account) : t("create.connectWalletShort")}
                      </span>
                    </div>
                  </div>

                  <label className="text-sm font-medium text-slate-200">
                    {t("streams.receiver")}
                    <input
                      value={form.receiver}
                      onChange={(event) => setForm((prev) => ({ ...prev, receiver: event.target.value }))}
                      placeholder="0x..."
                      className="input-shell mt-2"
                    />
                    <span className="mt-2 block text-xs text-slate-500">{t("create.receiverHint")}</span>
                  </label>
                </div>
              </section>

              <section className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <label className="text-sm font-medium text-slate-200">
                    {t("common.token")}
                    <input
                      value={form.token}
                      onChange={(event) => setForm((prev) => ({ ...prev, token: event.target.value }))}
                      placeholder="0x..."
                      className="input-shell mt-2"
                    />
                    <span className="mt-2 block text-xs text-slate-500">{t("create.tokenHint")}</span>
                  </label>

                  {presetTokens.length > 0 ? (
                    <label className="text-sm font-medium text-slate-200">
                      {t("create.presetTokens")}
                      <select
                        value={selectedPreset?.address ?? ""}
                        onChange={(event) => {
                          const nextToken = event.target.value;
                          if (!nextToken) return;
                          setForm((prev) => ({ ...prev, token: nextToken }));
                        }}
                        className="input-shell mt-2"
                      >
                        <option value="" className="bg-[#10161f]">
                          {t("create.selectToken")}
                        </option>
                        {presetTokens.map((preset) => (
                          <option key={preset.address} value={preset.address} className="bg-[#10161f]">
                            {preset.symbol}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="grid gap-5 lg:grid-cols-3">
                  <label className="text-sm font-medium text-slate-200">
                    {t("streams.deposit")}
                    <input
                      value={form.deposit}
                      onChange={(event) => setForm((prev) => ({ ...prev, deposit: event.target.value }))}
                      placeholder="1000"
                      className="input-shell mt-2"
                    />
                  </label>

                  <label className="text-sm font-medium text-slate-200">
                    {t("create.durationSeconds")}
                    <input
                      value={form.durationSeconds}
                      onChange={(event) => setForm((prev) => ({ ...prev, durationSeconds: event.target.value }))}
                      placeholder="2592000"
                      className="input-shell mt-2"
                    />
                  </label>

                  <label className="text-sm font-medium text-slate-200">
                    {t("create.cliffSeconds")}
                    <input
                      value={form.cliffSeconds}
                      onChange={(event) => setForm((prev) => ({ ...prev, cliffSeconds: event.target.value }))}
                      placeholder="0"
                      className="input-shell mt-2"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                  <p>{t("create.helperDuration", { value: formatDurationLabel(form.durationSeconds, t) })}</p>
                  <p>{t("create.helperCliff", { value: t("time.secondCompact", { count: form.cliffSeconds || "0" }) })}</p>
                  <p>
                    {t("create.helperTokenValidity", {
                      value: tokenLooksValid ? t("create.tokenValidityValid") : t("create.tokenValidityInvalid"),
                    })}
                  </p>
                  <p>{t("create.helperNetwork", { value: polkadotHubTestnet.name })}</p>
                </div>
              </section>

              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="eyebrow">{t("create.submitTitle")}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {createDisabled ? createDisabledReason : t("create.precheckHint")}
                    </p>
                  </div>

                  <button
                    onClick={() => void onCreate()}
                    disabled={createDisabled}
                    title={createDisabled ? createDisabledReason : ""}
                    className="button-primary min-w-[220px] justify-center py-4 text-base"
                  >
                    {isCreating ? t("create.creating") : t("create.button")}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="panel-muted p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">{t("create.precheckTitle")}</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("create.submitTitle")}</h3>
                </div>
                {isPreflightChecking ? <Loader2 className="size-4 animate-spin text-cyan-200" /> : null}
              </div>

              <ul className="mt-4 space-y-2">
                <li className="flex items-center justify-between rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm">
                  <span className="text-slate-300">{t("create.precheckWallet")}</span>
                  <span className="font-mono-ui text-xs uppercase tracking-[0.16em] text-slate-400">
                    {statusLabel(t, account ? true : null)}
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm">
                  <span className="text-slate-300">{t("create.precheckChain", { id: polkadotHubTestnet.id })}</span>
                  <span className="font-mono-ui text-xs uppercase tracking-[0.16em] text-slate-400">
                    {statusLabel(t, preflight.chainOk)}
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm">
                  <span className="text-slate-300">{t("create.precheckContract")}</span>
                  <span className="font-mono-ui text-xs uppercase tracking-[0.16em] text-slate-400">
                    {statusLabel(t, preflight.contractOk)}
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm">
                  <span className="text-slate-300">{t("create.precheckNotifier")}</span>
                  <span className="font-mono-ui text-xs uppercase tracking-[0.16em] text-slate-400">
                    {statusLabel(t, preflight.notifierOk)}
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm">
                  <span className="text-slate-300">{t("create.precheckToken")}</span>
                  <span className="font-mono-ui text-xs uppercase tracking-[0.16em] text-slate-400">
                    {statusLabel(t, preflight.tokenAllowed)}
                  </span>
                </li>
              </ul>

              <p className="mt-4 text-sm leading-6 text-orange-100">{createDisabledReason}</p>
            </section>

            <section className="panel p-5">
              <p className="eyebrow">{t("create.liveSummaryEyebrow")}</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("create.liveSummaryTitle")}</h3>

              <div className="mt-4 space-y-3 text-sm">
                {summaryRows.map((row) => (
                  <SummaryRow key={row.label} label={row.label} value={row.value} mono={row.mono} />
                ))}
              </div>

              <div className="mt-5 rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                <p className="inline-flex items-center gap-2 font-medium text-white">
                  <CheckCircle2 className="size-4 text-emerald-200" />
                  {t("create.demoNoteTitle")}
                </p>
                <p className="mt-2">{t("create.demoNoteBody")}</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
      <span className="text-slate-400">{label}</span>
      <span className={mono ? "font-mono-ui text-xs text-slate-100" : "font-medium text-white"}>{value}</span>
    </div>
  );
}
