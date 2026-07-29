import { TuningEnginesClient } from "./client";

const DEFAULT_INFERENCE_URL = "https://api.tuningengines.com/v1";
const SAFE_ENDPOINTS = new Set([
  "/chat/completions",
  "/responses",
  "/embeddings",
  "/messages",
  "/messages/count_tokens",
  "/mcp/tools",
  "/mcp/tools/call",
  "/skills",
]);

export function parseJsonObject(raw: string, label = "payload"): Record<string, any> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed;
}

export async function resolveInferenceBearer(
  client: TuningEnginesClient,
  explicitKey?: string
): Promise<string> {
  const direct = explicitKey || process.env.TE_INFERENCE_KEY;
  if (direct) return direct;

  const response = await client.getInferenceJwt();
  const token = response.access_token || response.token || response.jwt;
  if (!token) {
    throw new Error(
      "Could not obtain an inference credential. Set TE_INFERENCE_KEY or pass --key."
    );
  }
  return String(token);
}

export async function callInference(
  endpoint: string,
  payload: Record<string, any> | undefined,
  bearer: string,
  options?: { baseUrl?: string; method?: "GET" | "POST"; stream?: boolean }
): Promise<any> {
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const isResourceEndpoint =
    normalized.startsWith("/agents/") && normalized.endsWith("/message") ||
    normalized.startsWith("/skills/") &&
      (normalized.endsWith("/prepare") || normalized.endsWith("/invoke"));
  if (!SAFE_ENDPOINTS.has(normalized) && !isResourceEndpoint) {
    throw new Error(`Unsupported inference endpoint '${normalized}'`);
  }

  const baseUrl = (options?.baseUrl || process.env.TE_INFERENCE_URL || DEFAULT_INFERENCE_URL)
    .replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${normalized}`, {
    method: options?.method || "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: options?.stream ? "text/event-stream, application/json" : "application/json",
      "Content-Type": "application/json",
    },
    body: options?.method === "GET" ? undefined : JSON.stringify(payload || {}),
  });

  if (options?.stream && response.body) {
    if (!response.ok) {
      throw new Error(`Inference API Error (${response.status}): ${redact(await response.text())}`);
    }
    for await (const chunk of response.body as any) {
      process.stdout.write(Buffer.from(chunk));
    }
    return undefined;
  }

  const text = await response.text();
  let parsed: any = text;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    // Preserve non-JSON success responses while keeping error details bounded.
  }
  if (!response.ok) {
    const message = typeof parsed === "object"
      ? parsed?.error?.message || parsed?.detail || JSON.stringify(parsed)
      : text;
    throw new Error(`Inference API Error (${response.status}): ${redact(String(message)).slice(0, 1_000)}`);
  }
  return parsed;
}

function redact(value: string): string {
  return value
    .replace(/\bsk-te-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi, "Bearer [REDACTED]");
}
