import { SuccessSignalFields, TraceAdapterOptions } from "./shared";
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
export declare function createOpenAIAgentsTraceAdapter(options?: TraceAdapterOptions): OpenAIAgentsAdapter;
export * from "./shared";
//# sourceMappingURL=openai-agents.d.ts.map