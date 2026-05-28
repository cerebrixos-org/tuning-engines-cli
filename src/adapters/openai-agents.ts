import {
  SuccessSignalFields,
  TraceAdapterOptions,
  compact,
  createAdapterClient,
  sendTraceEvent,
} from "./shared";

export interface OpenAIAgentsAdapter {
  runId: string | undefined;
  startRun(metadata?: Record<string, any>): Promise<any>;
  recordModelCall(metadata?: Record<string, any>): Promise<any>;
  recordToolCall(metadata?: Record<string, any>): Promise<any>;
  recordHandoff(metadata?: Record<string, any>): Promise<any>;
  recordError(error: unknown, metadata?: Record<string, any>): Promise<any>;
  recordOutcome(fields: SuccessSignalFields, metadata?: Record<string, any>): Promise<any>;
  recordGoal(fields: SuccessSignalFields, metadata?: Record<string, any>): Promise<any>;
  finishRun(metadata?: Record<string, any>): Promise<any>;
}

export function createOpenAIAgentsTraceAdapter(options: TraceAdapterOptions = {}): OpenAIAgentsAdapter {
  const client = createAdapterClient(options);
  const adapterOptions = {
    ...options,
    runtime: options.runtime || "openai_agents",
    telemetrySource: options.telemetrySource || "sdk",
  };

  return {
    runId: adapterOptions.runId,

    startRun(metadata?: Record<string, any>) {
      return sendTraceEvent(client, adapterOptions, {
        type: "run.started",
        status: "running",
        metadata,
      });
    },

    recordModelCall(metadata?: Record<string, any>) {
      return sendTraceEvent(client, adapterOptions, {
        type: "model.call",
        metadata,
      });
    },

    recordToolCall(metadata?: Record<string, any>) {
      return sendTraceEvent(client, adapterOptions, {
        type: "tool.call",
        metadata,
      });
    },

    recordHandoff(metadata?: Record<string, any>) {
      return sendTraceEvent(client, adapterOptions, {
        type: "agent.handoff",
        metadata,
      });
    },

    recordError(error: unknown, metadata?: Record<string, any>) {
      return sendTraceEvent(client, adapterOptions, {
        type: "run.error",
        status: "failed",
        metadata: compact({
          ...metadata,
          error_message: error instanceof Error ? error.message : String(error),
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
