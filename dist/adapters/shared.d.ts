import { TuningEnginesClient } from "../client";
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
export declare function createAdapterClient(options?: TraceAdapterOptions): TuningEnginesClient;
export declare function ensureRunId(prefix?: string): string;
export declare function ensureRequestId(prefix?: string): string;
export declare function redactMetadata(value: any): any;
export declare function compact(value: Record<string, any>): Record<string, any>;
export declare function buildTracePayload(options: TraceAdapterOptions | undefined, event: TraceEventInput): Record<string, any>;
export declare function sendTraceEvent(client: TuningEnginesClient, options: TraceAdapterOptions | undefined, event: TraceEventInput): Promise<any>;
//# sourceMappingURL=shared.d.ts.map