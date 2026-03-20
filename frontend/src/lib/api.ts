import type { ApiSafeConfig, SettlementAuditWindow, SettlementMetricsSnapshot } from "../types";

const env = import.meta.env as Record<string, string | undefined>;

export const API_BASE_URL =
  env.NEXT_PUBLIC_API_BASE_URL ?? env.VITE_API_BASE_URL ?? "http://localhost:8787";

export const API_AUTH_TOKEN =
  env.NEXT_PUBLIC_API_AUTH_TOKEN ?? env.VITE_API_AUTH_TOKEN ?? "";

type ApiErrorPayload = {
  code?: string;
  message?: string;
};

async function requestJson<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (API_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${API_AUTH_TOKEN}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    let errorPayload: ApiErrorPayload | null = null;
    try {
      errorPayload = (await response.json()) as ApiErrorPayload;
    } catch {
      errorPayload = null;
    }
    const message = errorPayload?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchApiHealth(): Promise<{ status: string; timeUtc: string; config: ApiSafeConfig }> {
  return requestJson("/v1/health");
}

export async function fetchSettlementMetrics(from: number, to: number): Promise<SettlementMetricsSnapshot> {
  const result = await requestJson<{ metrics: SettlementMetricsSnapshot }>(
    `/v1/settlement/metrics?from=${from}&to=${to}`
  );
  return result.metrics;
}

export async function fetchSettlementAudit(from: number, to: number): Promise<SettlementAuditWindow[]> {
  const result = await requestJson<{ windows: SettlementAuditWindow[] }>(
    `/v1/settlement/audit?from=${from}&to=${to}&format=json`
  );
  return result.windows ?? [];
}
