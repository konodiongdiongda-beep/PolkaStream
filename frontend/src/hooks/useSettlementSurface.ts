import { useCallback, useEffect, useState } from "react";
import { isAddress, type Address } from "viem";

import { fetchApiHealth, fetchSettlementAudit, fetchSettlementMetrics, API_AUTH_TOKEN, API_BASE_URL } from "../lib/api";
import { useI18n } from "../i18n";
import {
  publicClient,
  usageSettlementHubAbi,
  USAGE_SETTLEMENT_HUB_ADDRESS,
} from "../lib/viem";
import type { SettlementAuditWindow, SettlementMetricsSnapshot, SettlementServiceState } from "../types";

type UseSettlementSurfaceArgs = {
  account: Address | null;
  token: Address | null;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const initialState: SettlementServiceState = {
  apiBaseUrl: API_BASE_URL,
  apiReachable: false,
  apiError: "",
  config: null,
  metrics: null,
  metricsError: "",
  windows: [],
  windowsError: "",
  hubAddress: null,
  token: null,
  tokenAllowed: null,
  payerEscrow: null,
  providerClaimable: null,
  hubReadError: "",
  authProvided: Boolean(API_AUTH_TOKEN),
  isLoading: false,
  lastSyncedAt: null,
};

const normalizeError = (
  error: unknown,
  t: (key: string, vars?: Record<string, string | number>) => string
) => {
  if (error instanceof Error) return error.message;
  return t("error.unknown");
};

const resolveHubAddress = (raw?: string | null): Address | null => {
  if (!raw || !isAddress(raw) || raw.toLowerCase() === ZERO_ADDRESS) return null;
  return raw as Address;
};

export function useSettlementSurface({ account, token }: UseSettlementSurfaceArgs) {
  const { t } = useI18n();
  const [state, setState] = useState<SettlementServiceState>({
    ...initialState,
    token,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, token }));

    let apiReachable = false;
    let apiError = "";
    let config = null;
    let metrics: SettlementMetricsSnapshot | null = null;
    let metricsError = "";
    let windows: SettlementAuditWindow[] = [];
    let windowsError = "";

    try {
      const health = await fetchApiHealth();
      apiReachable = true;
      config = health.config;
    } catch (error) {
      apiError = normalizeError(error, t);
    }

    if (apiReachable) {
      const now = Math.floor(Date.now() / 1000);
      const from = now - 24 * 60 * 60;

      try {
        metrics = await fetchSettlementMetrics(from, now);
      } catch (error) {
        metricsError = normalizeError(error, t);
      }

      try {
        windows = await fetchSettlementAudit(from, now);
      } catch (error) {
        windowsError = normalizeError(error, t);
      }
    }

    const hubAddress =
      resolveHubAddress(config?.usageSettlementHub) ?? resolveHubAddress(USAGE_SETTLEMENT_HUB_ADDRESS);

    let tokenAllowed = null;
    let payerEscrow = null;
    let providerClaimable = null;
    let hubReadError = "";

    if (hubAddress && token) {
      try {
        tokenAllowed = (await publicClient.readContract({
          address: hubAddress,
          abi: usageSettlementHubAbi,
          functionName: "tokenAllowlist",
          args: [token],
        })) as boolean;

        if (account) {
          const [payerValue, providerValue] = (await Promise.all([
            publicClient.readContract({
              address: hubAddress,
              abi: usageSettlementHubAbi,
              functionName: "payerEscrow",
              args: [account, token],
            }),
            publicClient.readContract({
              address: hubAddress,
              abi: usageSettlementHubAbi,
              functionName: "providerClaimable",
              args: [account, token],
            }),
          ])) as [bigint, bigint];

          payerEscrow = payerValue;
          providerClaimable = providerValue;
        }
      } catch (error) {
        hubReadError = normalizeError(error, t);
      }
    }

    setState({
      apiBaseUrl: API_BASE_URL,
      apiReachable,
      apiError,
      config,
      metrics,
      metricsError,
      windows,
      windowsError,
      hubAddress,
      token,
      tokenAllowed,
      payerEscrow,
      providerClaimable,
      hubReadError,
      authProvided: Boolean(API_AUTH_TOKEN),
      isLoading: false,
      lastSyncedAt: new Date().toISOString(),
    });
  }, [account, t, token]);

  useEffect(() => {
    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [refresh]);

  return {
    state,
    refresh,
  };
}
