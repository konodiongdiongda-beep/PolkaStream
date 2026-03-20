import { languageOptions, useI18n } from "../i18n";
import { POLKASTREAM_ADDRESS, RPC_URL, polkadotHubTestnet } from "../lib/viem";

export default function SettingsPanel() {
  const { t, language, setLanguage } = useI18n();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="panel-muted p-5 text-sm">
          <p className="eyebrow">{t("settings.surfaceEyebrow")}</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("settings.localeTitle")}</h3>
          <p className="mt-3 leading-6 text-slate-300">{t("settings.surfaceBody")}</p>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as typeof language)}
            className="input-shell mt-5"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#10161f]">
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-3 text-sm text-slate-400">{t("settings.languageHint")}</p>
        </section>

        <section className="panel p-5">
          <p className="eyebrow">{t("settings.environmentEyebrow")}</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("settings.environmentTitle")}</h3>

          <div className="mt-5 space-y-4">
            <ConfigRow label={t("settings.network")} value={polkadotHubTestnet.name} />
            <ConfigRow label={t("common.chainId")} value={String(polkadotHubTestnet.id)} mono />
            <ConfigRow label={t("settings.rpcUrl")} value={RPC_URL} mono />
            <ConfigRow label={t("settings.contract")} value={POLKASTREAM_ADDRESS} mono />
          </div>
        </section>
      </div>
    </div>
  );
}

function ConfigRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-3 break-all text-slate-100 ${mono ? "font-mono-ui text-xs leading-6" : "text-sm font-medium"}`}>
        {value}
      </p>
    </div>
  );
}
