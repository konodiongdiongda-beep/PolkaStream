import { RefreshCw } from "lucide-react";

import { useI18n } from "../i18n";
import type { PreflightState } from "../types";

type OpsPanelProps = {
  preflight: PreflightState;
  failedNotifyCount: number;
  onRefresh: () => Promise<void>;
};

export default function OpsPanel({ preflight, failedNotifyCount, onRefresh }: OpsPanelProps) {
  const { t } = useI18n();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Card title={t("ops.notifierHealth")} value={preflight.notifierOk ? t("status.ok") : t("status.fail")} />
          <Card title={t("ops.chainReady")} value={preflight.chainOk ? t("status.ok") : t("status.fail")} />
          <Card title={t("ops.failedNotify")} value={String(failedNotifyCount)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <section className="panel-muted p-5">
            <p className="eyebrow">{t("ops.refreshEyebrow")}</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("ops.refreshTitle")}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{t("ops.surfaceBody")}</p>
            <button onClick={() => void onRefresh()} className="button-secondary mt-5 inline-flex items-center gap-2">
              <RefreshCw className="size-4" />
              <span>{t("ops.refresh")}</span>
            </button>
          </section>

          <section className="panel-muted p-5 text-sm text-slate-300">
            <p className="eyebrow">{t("ops.surfaceEyebrow")}</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-white">{t("ops.adviceTitle")}</h3>
            <ul className="mt-4 space-y-2 leading-6">
              <li>1. {t("ops.advice1")}</li>
              <li>2. {t("ops.advice2")}</li>
              <li>3. {t("ops.advice3")}</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="panel-muted p-5">
      <p className="eyebrow">{title}</p>
      <p className="mt-2 font-display text-[1.9rem] font-semibold text-white">{value}</p>
    </div>
  );
}
