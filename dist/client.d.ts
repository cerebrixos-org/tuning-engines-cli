export interface ClientOptions {
    apiKey: string;
    apiUrl: string;
}
export interface ApiError {
    code: string;
    message: string;
}
export declare class TuningEnginesClient {
    private apiKey;
    private apiUrl;
    constructor(options: ClientOptions);
    listJobs(options?: {
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getJob(jobId: string): Promise<any>;
    createJob(params: {
        base_model?: string;
        output_name: string;
        repo_url?: string;
        branch?: string;
        github_token?: string;
        num_epochs?: number;
        max_examples?: number;
        base_user_model_id?: string;
        s3_output_bucket?: string;
        s3_access_key_id?: string;
        s3_secret_access_key?: string;
        s3_region?: string;
        agent?: string;
        quality_tier?: string;
    }): Promise<any>;
    cancelJob(jobId: string): Promise<any>;
    getJobStatus(jobId: string): Promise<any>;
    retryJob(jobId: string, githubToken?: string): Promise<any>;
    estimateJob(params: {
        base_model?: string;
        num_epochs?: number;
        max_examples?: number;
        repo_size_mb?: number;
        base_user_model_id?: string;
    }): Promise<any>;
    listUserModels(): Promise<any>;
    getUserModel(modelId: string): Promise<any>;
    deleteUserModel(modelId: string): Promise<any>;
    getUserModelStatus(modelId: string): Promise<any>;
    importModel(params: {
        name: string;
        source_s3_url: string;
        base_model: string;
        s3_access_key_id: string;
        s3_secret_access_key: string;
        s3_region: string;
    }): Promise<any>;
    exportModel(modelId: string, params: {
        s3_bucket: string;
        s3_prefix?: string;
        s3_access_key_id: string;
        s3_secret_access_key: string;
        s3_region: string;
        delete_after?: boolean;
    }): Promise<any>;
    validateS3(params: {
        s3_bucket: string;
        s3_access_key_id: string;
        s3_secret_access_key: string;
        s3_region: string;
    }): Promise<any>;
    listModels(): Promise<any>;
    getBilling(): Promise<any>;
    getAccount(): Promise<any>;
    static createDeviceSession(apiUrl: string): Promise<{
        device_code: string;
        verification_url: string;
        expires_in: number;
        poll_interval: number;
    }>;
    static pollDeviceSession(apiUrl: string, deviceCode: string): Promise<{
        status: string;
        api_token?: string;
    }>;
    private static requestNoAuth;
    private request;
}
//# sourceMappingURL=client.d.ts.map