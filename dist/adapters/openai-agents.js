"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOpenAIAgentsTraceAdapter = createOpenAIAgentsTraceAdapter;
const shared_1 = require("./shared");
function createOpenAIAgentsTraceAdapter(options = {}) {
    const client = (0, shared_1.createAdapterClient)(options);
    const adapterOptions = {
        ...options,
        runtime: options.runtime || "openai_agents",
        telemetrySource: options.telemetrySource || "sdk",
    };
    return {
        runId: adapterOptions.runId,
        startRun(metadata) {
            return (0, shared_1.sendTraceEvent)(client, adapterOptions, {
                type: "run.started",
                status: "running",
                metadata,
            });
        },
        recordModelCall(metadata) {
            return (0, shared_1.sendTraceEvent)(client, adapterOptions, {
                type: "model.call",
                metadata,
            });
        },
        recordToolCall(metadata) {
            return (0, shared_1.sendTraceEvent)(client, adapterOptions, {
                type: "tool.call",
                metadata,
            });
        },
        recordHandoff(metadata) {
            return (0, shared_1.sendTraceEvent)(client, adapterOptions, {
                type: "agent.handoff",
                metadata,
            });
        },
        recordError(error, metadata) {
            return (0, shared_1.sendTraceEvent)(client, adapterOptions, {
                type: "run.error",
                status: "failed",
                metadata: (0, shared_1.compact)({
                    ...metadata,
                    error_message: error instanceof Error ? error.message : String(error),
                }),
            });
        },
        recordOutcome(fields, metadata) {
            return (0, shared_1.sendTraceEvent)(client, adapterOptions, {
                type: "outcome.recorded",
                status: "succeeded",
                metadata: (0, shared_1.compact)({ ...metadata, ...fields, signal_kind: "outcome" }),
            });
        },
        recordGoal(fields, metadata) {
            return (0, shared_1.sendTraceEvent)(client, adapterOptions, {
                type: "outcome.recorded",
                status: "succeeded",
                metadata: (0, shared_1.compact)({ ...metadata, ...fields, signal_kind: "goal" }),
            });
        },
        finishRun(metadata) {
            return (0, shared_1.sendTraceEvent)(client, adapterOptions, {
                type: "run.completed",
                status: "succeeded",
                metadata,
            });
        },
    };
}
__exportStar(require("./shared"), exports);
//# sourceMappingURL=openai-agents.js.map