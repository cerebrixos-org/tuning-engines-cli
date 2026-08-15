import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const name = "tuning-engines";

const EVENT_TYPES = new Map([
  ["turn/start", ["agent.message", "started"]],
  ["turn/end", ["action.finalized", "succeeded"]],
  ["step/start", ["model.call", "started"]],
  ["step/end", ["workflow.step", "succeeded"]],
  ["user/message", ["agent.message", "started"]],
  ["assistant/message", ["model.call", "succeeded"]],
  ["tool/call", ["agent.tool_call", "proposed"]],
  ["tool/result", ["agent.tool_call", "succeeded"]],
  ["llm/retry", ["workflow.step", "failed"]],
  ["approval/requested", ["approval.requested", "pending"]],
  ["approval/approved", ["approval.approved", "succeeded"]],
  ["approval/denied", ["approval.denied", "blocked"]],
]);

const SECRET_PATTERN = /(api[_-]?key|secret|token|password|authorization|credential)/i;

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function bounded(value, limit = 240) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : undefined;
}

function sessionIdentity(session) {
  return bounded(session?.id || session?.sessionId || session?.meta?.id || "unknown-session", 200);
}

function eventCoordinates(event) {
  const data = event?.data || {};
  return {
    turn: Number.isFinite(data.turn) ? data.turn : 0,
    step: Number.isFinite(data.step) ? data.step : 0,
  };
}

function traceIds(session, event) {
  const sessionId = sessionIdentity(session);
  const { turn, step } = eventCoordinates(event);
  const sessionHash = hash(sessionId).slice(0, 20);
  return {
    sessionId,
    runId: `run_dsh_${sessionHash}_${turn || "session"}`,
    requestId: `req_dsh_${hash(`${sessionId}:${turn}:${step}`).slice(0, 24)}`,
  };
}

function eventId(sessionId, event) {
  return `evt_dsh_${hash(`${sessionId}:${event?.seq ?? "unknown"}:${event?.type ?? "unknown"}`).slice(0, 28)}`;
}

function toolResult(event) {
  return event?.data?.message?.content?.find?.((block) => block?.type === "tool-result");
}

function safeEventMetadata(event) {
  const data = event?.data || {};
  const coordinates = eventCoordinates(event);
  const result = toolResult(event);
  const toolCallId = bounded(data.callId || result?.toolCallId, 200);
  const metadata = {
    native_event_type: bounded(event?.type, 100),
    native_sequence: event?.seq,
    turn_id: coordinates.turn ? `turn_${coordinates.turn}` : undefined,
    step_id: coordinates.step ? `step_${coordinates.step}` : undefined,
    tool_call_id: toolCallId,
    tool_name: event?.type === "tool/call" ? bounded(data.name, 160) : undefined,
    arguments_sha256: event?.type === "tool/call" && data.arguments ? `sha256:${hash(data.arguments)}` : undefined,
    error_code: bounded(data.error?.code, 120),
    error_name: bounded(data.error?.name, 120),
    usage: event?.type === "assistant/message" ? sanitizeUsage(data.usage) : undefined,
    human_summary: summaryFor(event),
    capture_mode: "metadata_only",
    redaction_version: "dsh-metadata-v1",
  };
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

function sanitizeUsage(usage) {
  if (!usage || typeof usage !== "object") return undefined;
  const result = {};
  for (const [key, value] of Object.entries(usage)) {
    if (!SECRET_PATTERN.test(key) && typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

function summaryFor(event) {
  const data = event?.data || {};
  switch (event?.type) {
    case "turn/start": return "DeepSeek Harness turn started";
    case "turn/end": return `DeepSeek Harness turn ${data.reason?.kind || "completed"}`;
    case "step/start": return "Model step started";
    case "step/end": return "Model step completed";
    case "user/message": return "User message submitted";
    case "assistant/message": return "Model response completed";
    case "tool/call": return bounded(`Requested tool: ${data.name || "unknown"}`);
    case "tool/result": return data.error || toolResult(event)?.isError ? "Tool execution failed" : "Tool execution completed";
    case "llm/retry": return "Model request scheduled for retry";
    default: return bounded(String(event?.type || "Harness event").replaceAll("/", " "));
  }
}

export function normalizeSessionEvent(session, event) {
  const mapping = EVENT_TYPES.get(event?.type);
  if (!mapping) return null;

  const ids = traceIds(session, event);
  const result = toolResult(event);
  let status = mapping[1];
  if (event.type === "turn/end" && dataIndicatesFailure(event.data)) status = "failed";
  if (event.type === "tool/result" && (event.data?.error || result?.isError)) status = "failed";

  const id = eventId(ids.sessionId, event);
  const parentId = event.type === "tool/result" && result?.toolCallId
    ? `evt_dsh_${hash(`${ids.sessionId}:tool:${result.toolCallId}`).slice(0, 28)}`
    : undefined;
  const stableId = event.type === "tool/call" && event.data?.callId
    ? `evt_dsh_${hash(`${ids.sessionId}:tool:${event.data.callId}`).slice(0, 28)}`
    : id;

  return {
    event_id: stableId,
    run_id: ids.runId,
    request_id: ids.requestId,
    session_id: ids.sessionId,
    runtime: "deepseek_harness",
    event: {
      id: stableId,
      parent_id: parentId,
      type: mapping[0],
      status,
      at: new Date(event?.time || Date.now()).toISOString(),
      metadata: {
        run_id: ids.runId,
        request_id: ids.requestId,
        session_id: ids.sessionId,
        runtime: "deepseek_harness",
        telemetry_source: "native_plugin",
        ...safeEventMetadata(event),
      },
    },
  };
}

function dataIndicatesFailure(data) {
  const kind = String(data?.reason?.kind || "").toLowerCase();
  return ["error", "failed", "cancelled", "canceled", "interrupted", "rejected"].includes(kind);
}

export class DurableTraceQueue {
  constructor(config) {
    this.apiUrl = String(config.apiUrl || "https://app.tuningengines.com").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.maxBatchSize = Math.max(1, Math.min(Number(config.maxBatchSize || 64), 500));
    this.spoolPath = config.spoolPath || path.join(os.homedir(), ".tuningengines", "dsh-trace-spool.jsonl");
    this.flushing = false;
    fs.mkdirSync(path.dirname(this.spoolPath), { recursive: true, mode: 0o700 });
  }

  enqueue(record) {
    if (!record) return;
    fs.appendFileSync(this.spoolPath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  read() {
    if (!fs.existsSync(this.spoolPath)) return [];
    return fs.readFileSync(this.spoolPath, "utf8").split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const records = this.read();
      if (!records.length) return;
      const selected = records.slice(0, this.maxBatchSize);
      const byRun = new Map();
      for (const record of selected) {
        const group = byRun.get(record.run_id) || [];
        group.push(record);
        byRun.set(record.run_id, group);
      }
      const delivered = new Set();
      for (const group of byRun.values()) {
        const first = group[0];
        const status = terminalStatus(group.map((record) => record.event));
        await this.post({
          run_id: first.run_id,
          request_id: first.request_id,
          name: "DeepSeek Harness session",
          runtime: "deepseek_harness",
          telemetry_source: "native_plugin",
          status,
          metadata: { session_id: first.session_id, capture_mode: "metadata_only" },
          events: group.map((record) => record.event),
        });
        group.forEach((record) => delivered.add(record.event_id));
      }
      const remaining = records.filter((record) => !delivered.has(record.event_id));
      fs.writeFileSync(this.spoolPath, remaining.map((record) => JSON.stringify(record)).join("\n") + (remaining.length ? "\n" : ""), { mode: 0o600 });
    } finally {
      this.flushing = false;
    }
  }

  async post(payload) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`${this.apiUrl}/api/v1/traces`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": "tuningengines-dsh-plugin/0.1.0",
          },
          body: JSON.stringify(payload),
        });
        if (response.ok) return;
        const message = bounded(await response.text(), 300);
        const error = new Error(`Trace ingest returned HTTP ${response.status}${message ? `: ${message}` : ""}`);
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
    }
    throw lastError || new Error("Trace delivery failed");
  }
}

function terminalStatus(events) {
  if (events.some((event) => event.type === "action.finalized" && event.status === "failed")) return "failed";
  if (events.some((event) => event.type === "action.finalized" && event.status === "succeeded")) return "succeeded";
  return "running";
}

async function evaluateTool(config, exec) {
  const response = await fetch(`${String(config.apiUrl).replace(/\/$/, "")}/api/v1/agent_actions/evaluate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "tuningengines-dsh-plugin/0.1.0",
    },
    body: JSON.stringify({
      runtime: "deepseek_harness",
      hook_event: "PreToolUse",
      phase: "proposed",
      enforce: config.governanceMode === "enforce",
      session_id: sessionIdentity(exec?.agent?.session),
      tool_name: bounded(exec?.name, 160),
      tool_input: { sha256: `sha256:${hash(JSON.stringify(exec?.arguments || {}))}` },
      metadata: { capture_mode: "metadata_only", source: "deepseek_harness_plugin" },
    }),
  });
  if (!response.ok) throw new Error(`Governance evaluation returned HTTP ${response.status}`);
  return response.json();
}

export function apply(ctx, inputConfig = {}) {
  const config = {
    apiUrl: inputConfig.apiUrl || "https://app.tuningengines.com",
    apiKey: inputConfig.apiKey,
    governanceMode: inputConfig.governanceMode || "observe",
    flushIntervalMs: Math.max(250, Number(inputConfig.flushIntervalMs || 2000)),
    maxBatchSize: inputConfig.maxBatchSize || 64,
    spoolPath: inputConfig.spoolPath,
  };
  if (!config.apiKey) throw new Error("TE_API_KEY or TE_INFERENCE_KEY is required by tuningengines-dsh-plugin");
  if (!["off", "observe", "enforce"].includes(config.governanceMode)) throw new Error("governanceMode must be off, observe, or enforce");

  const queue = new DurableTraceQueue(config);
  ctx.on("session/event", (session, event) => {
    const record = normalizeSessionEvent(session, event);
    if (record) queue.enqueue(record);
  });

  if (config.governanceMode !== "off") {
    ctx.on("tools/pre-execute", async (exec, next) => {
      try {
        const result = await evaluateTool(config, exec);
        const decision = result?.decision || result;
        if (config.governanceMode !== "enforce") return next();
        if (["deny", "blocked"].includes(decision?.action || decision?.decision)) {
          return { kind: "deny", reason: bounded(decision?.reason, 300) || "Blocked by Tuning Engines policy" };
        }
        if (["needs_approval", "approval_required"].includes(decision?.action || decision?.decision)) {
          return { kind: "ask", reason: bounded(decision?.reason, 300) || "Tuning Engines approval required" };
        }
      } catch (error) {
        if (config.governanceMode === "enforce") return { kind: "deny", reason: `Tuning Engines governance unavailable: ${bounded(error?.message, 200)}` };
      }
      return next();
    });
  }

  ctx.effect(() => {
    const timer = setInterval(() => void queue.flush().catch((error) => console.warn(`[tuning-engines] ${bounded(error?.message, 300)}`)), config.flushIntervalMs);
    void queue.flush().catch(() => undefined);
    return () => {
      clearInterval(timer);
      void queue.flush().catch(() => undefined);
    };
  });
}
