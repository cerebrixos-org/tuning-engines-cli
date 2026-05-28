"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdapterClient = createAdapterClient;
exports.ensureRunId = ensureRunId;
exports.ensureRequestId = ensureRequestId;
exports.redactMetadata = redactMetadata;
exports.compact = compact;
exports.buildTracePayload = buildTracePayload;
exports.sendTraceEvent = sendTraceEvent;
const client_1 = require("../client");
const config_1 = require("../config");
const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|password|authorization|credential|private[_-]?key)/i;
function createAdapterClient(options) {
    return new client_1.TuningEnginesClient({
        apiKey: options?.apiKey || (0, config_1.getApiKey)(),
        apiUrl: options?.apiUrl || (0, config_1.getApiUrl)(),
    });
}
function ensureRunId(prefix = "run") {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}
function ensureRequestId(prefix = "req") {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}
function redactMetadata(value) {
    if (Array.isArray(value))
        return value.map((item) => redactMetadata(item));
    if (!value || typeof value !== "object")
        return value;
    const redacted = {};
    Object.entries(value).forEach(([key, entry]) => {
        redacted[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactMetadata(entry);
    });
    return redacted;
}
function compact(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
function buildTracePayload(options, event) {
    const runId = event.runId || options?.runId || ensureRunId();
    const requestId = event.requestId || options?.requestId || ensureRequestId();
    const metadata = compact({
        ...redactMetadata(options?.metadata || {}),
        ...redactMetadata(event.metadata || {}),
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
async function sendTraceEvent(client, options, event) {
    return client.createTrace(buildTracePayload(options, event));
}
//# sourceMappingURL=shared.js.map