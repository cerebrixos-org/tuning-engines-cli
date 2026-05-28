import { SuccessSignalFields, TraceAdapterOptions } from "./shared";
export interface ClaudeAgentSdkAdapter {
    runId: string | undefined;
    recordHook(eventName: string, payload?: Record<string, any>, metadata?: Record<string, any>): Promise<any>;
    recordOutcome(fields: SuccessSignalFields, metadata?: Record<string, any>): Promise<any>;
    recordGoal(fields: SuccessSignalFields, metadata?: Record<string, any>): Promise<any>;
    finishRun(metadata?: Record<string, any>): Promise<any>;
}
export declare function createClaudeAgentSdkTraceAdapter(options?: TraceAdapterOptions): ClaudeAgentSdkAdapter;
export * from "./shared";
//# sourceMappingURL=claude-agent-sdk.d.ts.map