import { TuningEnginesClient } from "../client";
import { getApiKey, getApiUrl } from "../config";

export interface SuccessSignalFields {
  goal_key?: string;
  goal_text?: string;
  goal_status?: string;
  goal_score?: number;
  outcome_key?: string;
  outcome_label?: string;
  outcome_score?: number;
}

export interface TraceAdapterOptions {
  apiKey?: string;
  apiUrl?: string;
  runId?: string;
  requestId?: string;
  runtime?: string;
  telemetrySource?: string;
  metadata?: Record<string, any>;
}

export interface TraceEventInput {
  type: string;
  status?: string;
  requestId?: string;
  runId?: string;
  metadata?: Record<string, any>;
}

const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|password|authorization|credential|private[_-]?key)/i;

export function createAdapterClient(options?: TraceAdapterOptions): TuningEnginesClient {
  return new TuningEnginesClient({
    apiKey: options?.apiKey || getApiKey(),
    apiUrl: options?.apiUrl || getApiUrl(),
  });
}

export function ensureRunId(prefix = "run"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function ensureRequestId(prefix = "req"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function redactMetadata(value: any): any {
  if (Array.isArray(value)) return value.map((item) => redactMetadata(item));
  if (!value || typeof value !== "object") return value;

  const redacted: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    redacted[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactMetadata(entry);
  });
  return redacted;
}

export function compact(value: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

export function buildTracePayload(
  options: TraceAdapterOptions | undefined,
  event: TraceEventInput
): Record<string, any> {
  const runId = event.runId || options?.runId || ensureRunId();
  const requestId = event.requestId || options?.requestId || ensureRequestId();
  const metadata = compact({
    ...(redactMetadata(options?.metadata || {}) as Record<string, any>),
    ...(redactMetadata(event.metadata || {}) as Record<string, any>),
  });

  return compact({
    run_id: runId,
    request_id: requestId,
    runtime: options?.runtime || "custom",
    telemetry_source: options?.telemetrySource || "sdk",
    status: event.status || "running",
    metadata: compact({ request_id: requestId }),
    events: [
      {
        id: `evt_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
        type: event.type,
        status: event.status || "succeeded",
        metadata,
      },
    ],
  });
}

export async function sendTraceEvent(
  client: TuningEnginesClient,
  options: TraceAdapterOptions | undefined,
  event: TraceEventInput
): Promise<any> {
  return client.createTrace(buildTracePayload(options, event));
}
