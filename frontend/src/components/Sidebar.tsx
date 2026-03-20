import {
  Activity,
  Bot,
  ExternalLink,
  Github,
  LayoutDashboard,
  PlusCircle,
  Settings,
  Shield,
  Waves,
} from "lucide-react";

import type { Page } from "../types";
import { useI18n } from "../i18n";
import { polkadotHubTestnet } from "../lib/viem";

type SidebarProps = {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  failedNotifyCount: number;
  isAdmin: boolean;
  apiReachable: boolean;
  hubConfigured: boolean;
};

const GITHUB_URL = "https://github.com/konodiongdiongda-beep/PolkaStream";
const ONCHAIN_EVIDENCE_URL = polkadotHubTestnet.blockExplorers.default.url;

const iconMap = {
  dashboard: LayoutDashboard,
  streams: Waves,
  "create-stream": PlusCircle,
  settlements: Bot,
  ops: Shield,
  settings: Settings,
} as const;

export default function Sidebar({
  currentPage,
  onPageChange,
  failedNotifyCount,
  isAdmin,
  apiReachable,
  hubConfigured,
}: SidebarProps) {
  const { t } = useI18n();

  const primaryItems: Array<{ id: Page; label: string; badge?: "failedNotify" }> = [
    { id: "dashboard", label: t("nav.dashboard") },
    { id: "create-stream", label: t("nav.createStream") },
    { id: "settlements", label: t("nav.settlements") },
    { id: "streams", label: t("nav.streams"), badge: "failedNotify" },
  ];

  const secondaryItems: Array<{ id: Page; label: string; badge?: "failedNotify" }> = [
    { id: "ops", label: t("nav.ops") },
    { id: "settings", label: t("nav.settings") },
  ];

  const visibleSecondaryItems = secondaryItems.filter((item) => item.id !== "ops" || isAdmin);
  const navItems = [...primaryItems, ...visibleSecondaryItems];

  return (
    <>
      <div className="space-y-4 lg:hidden">
        <section className="panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-[16px] border border-cyan-300/18 bg-cyan-400/10 text-cyan-100">
                  <Activity className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="eyebrow">{t("dashboard.heroEyebrow")}</p>
                  <h1 className="truncate font-display text-[1.2rem] font-semibold tracking-[-0.04em] text-white">
                    PolkaStream
                  </h1>
                </div>
              </div>

              <p className="mt-3 text-sm font-medium text-slate-200">{t("dashboard.heroTitleCompact")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t("dashboard.heroBodyCompact")}</p>
            </div>

            <button onClick={() => onPageChange("create-stream")} className="button-primary shrink-0 px-3 py-2 text-xs">
              {t("sidebar.newStream")}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-lime-300/18 bg-lime-400/10 px-3 py-1.5 text-[11px] font-medium text-lime-100">
              {t("dashboard.badgeTestnet")}
            </span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"
            >
              <Github className="size-3.5" />
              <span>{t("app.github")}</span>
            </a>
            <a
              href={ONCHAIN_EVIDENCE_URL}
              target="_blank"
              rel="noreferrer"
              className="button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"
            >
              <ExternalLink className="size-3.5" />
              <span>{t("app.evidence")}</span>
            </a>
          </div>
        </section>

        <section className="panel-muted overflow-x-auto p-2">
          <div className="flex min-w-max gap-2">
            {navItems.map((item) => {
              const Icon = iconMap[item.id];
              const isActive = item.id === currentPage;
              const badge =
                item.badge === "failedNotify" && failedNotifyCount > 0 ? String(failedNotifyCount) : undefined;

              return (
                <NavPill
                  key={item.id}
                  icon={<Icon className="size-4" />}
                  label={item.label}
                  active={isActive}
                  badge={badge}
                  onClick={() => onPageChange(item.id)}
                />
              );
            })}
          </div>
        </section>
      </div>

      <aside className="hidden gap-4 lg:flex lg:flex-col">
        <section className="panel p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-[18px] border border-cyan-300/18 bg-cyan-400/10 text-cyan-100 shadow-[0_12px_28px_rgba(98,214,255,0.12)]">
              <Activity className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="eyebrow">{t("dashboard.heroEyebrow")}</p>
              <h1 className="font-display text-[1.24rem] font-semibold tracking-[-0.05em] text-white">PolkaStream</h1>
            </div>
          </div>

          <p className="mt-4 text-[0.95rem] font-semibold leading-6 text-slate-100">{t("dashboard.heroTitleCompact")}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{t("dashboard.heroBodyCompact")}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-lime-300/18 bg-lime-400/10 px-3 py-1.5 text-[11px] font-medium text-lime-100">
              {t("dashboard.badgeTestnet")}
            </span>
          </div>

          <div className="mt-5 grid gap-2">
            <ResourceLink href={GITHUB_URL} icon={<Github className="size-4" />} label={t("app.github")} />
            <ResourceLink
              href={ONCHAIN_EVIDENCE_URL}
              icon={<ExternalLink className="size-4" />}
              label={t("app.evidence")}
            />
          </div>
        </section>

        <section className="panel-muted p-4">
          <p className="eyebrow px-1">{t("sidebar.section.console")}</p>
          <div className="mt-3 space-y-1.5">
            {primaryItems.map((item) => {
              const Icon = iconMap[item.id];
              const badge =
                item.badge === "failedNotify" && failedNotifyCount > 0 ? String(failedNotifyCount) : undefined;

              return (
                <RailButton
                  key={item.id}
                  icon={<Icon className="size-4" />}
                  label={item.label}
                  active={currentPage === item.id}
                  badge={badge}
                  onClick={() => onPageChange(item.id)}
                />
              );
            })}
          </div>

          {visibleSecondaryItems.length > 0 ? (
            <>
              <p className="eyebrow mt-6 px-1">{t("sidebar.section.secondary")}</p>
              <div className="mt-3 space-y-1.5">
                {visibleSecondaryItems.map((item) => {
                  const Icon = iconMap[item.id];

                  return (
                    <RailButton
                      key={item.id}
                      icon={<Icon className="size-4" />}
                      label={item.label}
                      active={currentPage === item.id}
                      onClick={() => onPageChange(item.id)}
                    />
                  );
                })}
              </div>
            </>
          ) : null}
        </section>

        <section className="panel-muted mt-auto p-4">
          <div className="flex items-center justify-between">
            <p className="eyebrow">{t("sidebar.section.system")}</p>
            <span className="text-[11px] font-medium text-slate-500">{t("sidebar.tagline")}</span>
          </div>

          <div className="mt-4 space-y-3">
            <SystemRow label={t("sidebar.streamContract")} value={t("common.live")} tone="default" />
            <SystemRow
              label={t("sidebar.settlementApi")}
              value={apiReachable ? t("common.reachable") : t("common.offline")}
              tone={apiReachable ? "cyan" : "muted"}
            />
            <SystemRow
              label={t("sidebar.settlementHub")}
              value={hubConfigured ? t("common.configured") : t("common.missing")}
              tone={hubConfigured ? "cyan" : "muted"}
            />
          </div>

          <p className="mt-4 text-xs leading-6 text-slate-500">{t("sidebar.description")}</p>
        </section>
      </aside>
    </>
  );
}

function RailButton({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-[18px] border px-3.5 py-3 text-left text-sm transition ${
        active
          ? "border-cyan-300/18 bg-cyan-400/10 text-white shadow-[0_14px_30px_rgba(98,214,255,0.08)]"
          : "border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.04] hover:text-slate-200"
      }`}
    >
      <span className="flex items-center gap-3">
        <span className={active ? "text-cyan-100" : "text-slate-500 group-hover:text-slate-300"}>{icon}</span>
        <span>{label}</span>
      </span>
      {badge ? (
        <span className="rounded-full border border-amber-300/16 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function NavPill({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-[14px] border px-3.5 py-2.5 text-sm transition ${
        active
          ? "border-cyan-300/18 bg-cyan-400/10 text-white"
          : "border-white/8 bg-white/[0.03] text-slate-300"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge ? (
        <span className="rounded-full border border-amber-300/16 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function ResourceLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="button-secondary inline-flex items-center justify-between gap-3 px-3.5 py-3 text-sm"
    >
      <span className="inline-flex items-center gap-2 text-slate-100">
        {icon}
        <span>{label}</span>
      </span>
      <ExternalLink className="size-4 text-slate-500" />
    </a>
  );
}

function SystemRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "cyan" | "muted";
}) {
  const valueClass =
    tone === "cyan" ? "text-cyan-100" : tone === "muted" ? "text-slate-500" : "text-slate-100";

  return (
    <div className="flex items-center justify-between rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
