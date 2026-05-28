import {
  SuccessSignalFields,
  TraceAdapterOptions,
  compact,
  createAdapterClient,
  sendTraceEvent,
} from "./shared";

export interface ClaudeAgentSdkAdapter {
  runId: string | undefined;
  recordHook(eventName: string, payload?: Record<string, any>, metadata?: Record<string, any>): Promise<any>;
  recordOutcome(fields: SuccessSignalFields, metadata?: Record<string, any>): Promise<any>;
  recordGoal(fields: SuccessSignalFields, metadata?: Record<string, any>): Promise<any>;
  finishRun(metadata?: Record<string, any>): Promise<any>;
}

function hookType(eventName: string): string {
  return `claude.${eventName.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
}

export function createClaudeAgentSdkTraceAdapter(options: TraceAdapterOptions = {}): ClaudeAgentSdkAdapter {
  const client = createAdapterClient(options);
  const adapterOptions = {
    ...options,
    runtime: options.runtime || "anthropic_sdk",
    telemetrySource: options.telemetrySource || "sdk",
  };

  return {
    runId: adapterOptions.runId,

    recordHook(eventName: string, payload?: Record<string, any>, metadata?: Record<string, any>) {
      return sendTraceEvent(client, adapterOptions, {
        type: hookType(eventName),
        status: eventName === "Stop" ? "succeeded" : "running",
        metadata: compact({
          ...metadata,
          hook: eventName,
          payload,
        }),
      });
    },

    recordOutcome(fields: SuccessSignalFields, metadata?: Record<string, any>) {
      return sendTraceEvent(client, adapterOptions, {
        type: "outcome.recorded",
        status: "succeeded",
        metadata: compact({ ...metadata, ...fields, signal_kind: "outcome" }),
      });
    },

    recordGoal(fields: SuccessSignalFields, metadata?: Record<string, any>) {
      return sendTraceEvent(client, adapterOptions, {
        type: "outcome.recorded",
        status: "succeeded",
        metadata: compact({ ...metadata, ...fields, signal_kind: "goal" }),
      });
    },

    finishRun(metadata?: Record<string, any>) {
      return sendTraceEvent(client, adapterOptions, {
        type: "run.completed",
        status: "succeeded",
        metadata,
      });
    },
  };
}

export * from "./shared";
