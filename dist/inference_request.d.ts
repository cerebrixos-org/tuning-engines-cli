import { TuningEnginesClient } from "./client";
export declare function parseJsonObject(raw: string, label?: string): Record<string, any>;
export declare function resolveInferenceBearer(client: TuningEnginesClient, explicitKey?: string): Promise<string>;
export declare function callInference(endpoint: string, payload: Record<string, any> | undefined, bearer: string, options?: {
    baseUrl?: string;
    method?: "GET" | "POST";
    stream?: boolean;
}): Promise<any>;
//# sourceMappingURL=inference_request.d.ts.map