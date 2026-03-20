export type Address = `0x${string}`;

export type UsageEventInput = {
  requestId?: string;
  eventId?: string;
  payer: Address;
  provider: Address;
  token: Address;
  usageUnits: string | number;
  unitPriceWei: string | number;
  amountWei?: string | number;
  requestTs: string | number;
  windowStart?: number;
  windowEnd?: number;
};

export type HealthResponse = {
  status: string;
  timeUtc: string;
  config: ConfigResponse;
};

export type ConfigResponse = {
  chainId: number | null;
  rpcUrl: string;
  polkaStream: string;
  usageSettlementHub: string;
  settlementWindowSeconds: number;
};

export type SettlementItem = {
  payer: Address;
  provider: Address;
  token: Address;
  amountWei: string;
  requestCount: number;
};

export type SettlementWindow = {
  windowId: string;
  windowStart: number;
  windowEnd: number;
  requestEvents: number;
  totalAmountWei: string;
  totalRequests: number;
  items: SettlementItem[];
};

export type SettlementMetrics = {
  requestEvents: number;
  batchedWindows: number;
  txReductionPct: number;
  avgAggregationLatencySeconds: number;
  throughputRequestsPerBatchTx: number;
};

export type StreamCommercialState = {
  streamId: string;
  status: string;
  statusCode: number;
  triggerPolicy: string;
  triggerPolicyCode: number;
  createdAt: number;
  activatedAt: number;
  activationDeadline: number;
  authorizedActivator: Address;
  serviceRef: `0x${string}`;
  senderConfirmed: boolean;
  receiverConfirmed: boolean;
  billingStarted: boolean;
};

export type OperatorContext = {
  enabled: boolean;
  address: Address | null;
  eligible?: boolean;
  reason?: string;
};

export type CommercialStateResponse = {
  streamId: string;
  contract: Address;
  commercialState: StreamCommercialState;
  operator: OperatorContext;
};

export type ServiceTriggerRecord = {
  serviceId: string;
  streamId: string;
  provider: Address;
  triggerMode: string;
  expectedTriggerPolicy: string;
  expectedServiceRef: string;
  status: "active" | "inactive";
  metadata: Record<string, unknown> | null;
  lastRequestId: string;
  lastTriggerResult: string;
  lastTriggeredAt: string | null;
  lastTxHash: string;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceTriggerResponse = {
  service: ServiceTriggerRecord;
  commercialState: StreamCommercialState | null;
  operator: OperatorContext;
};

export type ServiceTriggerUpsertInput = {
  streamId: string | number;
  provider: Address;
  triggerMode?: "on_request";
  expectedTriggerPolicy?: string | number;
  serviceRef?: string;
  expectedServiceRef?: string;
  status?: "active" | "inactive";
  metadata?: Record<string, unknown>;
};

export type ServiceTriggerInvocationInput = {
  requestId: string;
  streamId?: string | number;
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
};

export type ServiceTriggerInvocationResponse = {
  serviceId: string;
  requestId: string;
  streamId: string;
  result: string;
  activationTxHash: string | null;
  commercialState: StreamCommercialState | null;
  operator: OperatorContext;
  metadata: Record<string, unknown> | null;
  error: string | null;
};

export type SettlementPreviewResponse = {
  windowSeconds: number;
  metrics: SettlementMetrics;
  windows: SettlementWindow[];
};

export type SettlementSubmitResponse = {
  windowSeconds: number;
  metrics: SettlementMetrics;
  submitted: { windowId: string; txHash: string }[];
  failedCount: number;
};

export type SettlementRetryResponse = {
  submitted: { windowId: string; txHash: string }[];
  failedCount: number;
};

export type MetricsResponse = {
  from?: string | null;
  to?: string | null;
  metrics: SettlementMetrics;
};

export type EscrowResponse = {
  payer: Address;
  token: Address;
  amount: string;
};

export type ClaimableResponse = {
  provider: Address;
  token: Address;
  amount: string;
};

export type ClientOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  raw?: unknown;

  constructor(status: number, code: string, message: string, requestId?: string, raw?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.raw = raw;
  }
}

const DEFAULT_TIMEOUT = 15_000;

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function parseJsonSafe(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class PolkaStreamClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeoutMs: number;
  private headers?: Record<string, string>;

  constructor(options: ClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
    this.headers = options.headers;
  }

  setApiKey(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async health(): Promise<HealthResponse> {
    return this.request("GET", "/v1/health");
  }

  async config(): Promise<ConfigResponse> {
    return this.request("GET", "/v1/config");
  }

  async streamCommercialState(streamId: string | number): Promise<CommercialStateResponse> {
    return this.request("GET", `/v1/streams/${streamId}/commercial-state`);
  }

  async getService(serviceId: string): Promise<ServiceTriggerResponse> {
    return this.request("GET", `/v1/services/${encodeURIComponent(serviceId)}`);
  }

  async upsertService(serviceId: string, payload: ServiceTriggerUpsertInput): Promise<ServiceTriggerResponse> {
    return this.request("PUT", `/v1/services/${encodeURIComponent(serviceId)}`, payload);
  }

  async triggerService(
    serviceId: string,
    payload: ServiceTriggerInvocationInput
  ): Promise<ServiceTriggerInvocationResponse> {
    return this.request("POST", `/v1/services/${encodeURIComponent(serviceId)}/trigger`, payload);
  }

  async ingestUsageEvents(events: UsageEventInput[] | UsageEventInput): Promise<{ accepted: number }> {
    const list = Array.isArray(events) ? events : [events];
    return this.request("POST", "/v1/usage-events", { events: list });
  }

  async settlementPreview(payload?: { events?: UsageEventInput[]; windowSeconds?: number }): Promise<SettlementPreviewResponse> {
    return this.request("POST", "/v1/settlement/preview", payload ?? {});
  }

  async settlementSubmit(payload?: { events?: UsageEventInput[]; windowSeconds?: number }): Promise<SettlementSubmitResponse> {
    return this.request("POST", "/v1/settlement/submit", payload ?? {});
  }

  async settlementRetry(): Promise<SettlementRetryResponse> {
    return this.request("POST", "/v1/settlement/retry", {});
  }

  async settlementMetrics(params?: { from?: number | string; to?: number | string }): Promise<MetricsResponse> {
    const query: Record<string, string> = {};
    if (params?.from !== undefined) query.from = String(params.from);
    if (params?.to !== undefined) query.to = String(params.to);
    return this.request("GET", "/v1/settlement/metrics", undefined, query);
  }

  async payerEscrow(payer: Address, token: Address): Promise<EscrowResponse> {
    return this.request("GET", `/v1/payers/${payer}/escrow`, undefined, { token });
  }

  async providerClaimable(provider: Address, token: Address): Promise<ClaimableResponse> {
    return this.request("GET", `/v1/providers/${provider}/claimable`, undefined, { token });
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: unknown,
    query?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      ...(this.headers ?? {}),
    };
    if (method !== "GET") {
      headers["Content-Type"] = "application/json";
    }
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const controller = this.timeoutMs > 0 ? new AbortController() : null;
    const timeout = this.timeoutMs > 0 ? setTimeout(() => controller?.abort(), this.timeoutMs) : null;

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
      const text = await response.text();
      const data = (await parseJsonSafe(text)) ?? (text ? { message: text } : null);

      if (!response.ok) {
        const code = data?.code ?? "HTTP_ERROR";
        const message = data?.message ?? response.statusText;
        const requestId = data?.requestId;
        throw new ApiError(response.status, code, message, requestId, data);
      }

      return data as T;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
