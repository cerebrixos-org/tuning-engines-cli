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
        use_case?: string;
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
    listCatalogModels(options?: {
        category?: string;
        limit?: number;
    }): Promise<any>;
    getCatalogModel(modelId: string): Promise<any>;
    exportCatalogModel(modelId: string, params: {
        s3_bucket: string;
        s3_prefix?: string;
        s3_access_key_id: string;
        s3_secret_access_key: string;
        s3_region: string;
    }): Promise<any>;
    getCatalogExportStatus(modelId: string, exportId: string): Promise<any>;
    validateS3(params: {
        s3_bucket: string;
        s3_access_key_id: string;
        s3_secret_access_key: string;
        s3_region: string;
    }): Promise<any>;
    listModels(options?: {
        agent?: string;
    }): Promise<any>;
    getBilling(): Promise<any>;
    getAccount(): Promise<any>;
    listDatasets(options?: {
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getDataset(datasetId: string): Promise<any>;
    createDataset(params: {
        name: string;
        description?: string;
        source_type: string;
        s3_url?: string;
        s3_access_key_id?: string;
        s3_secret_access_key?: string;
        s3_region?: string;
        for_evaluation?: boolean;
    }): Promise<any>;
    updateDataset(datasetId: string, params: {
        name?: string;
        description?: string;
    }): Promise<any>;
    deleteDataset(datasetId: string): Promise<any>;
    getDatasetStatus(datasetId: string): Promise<any>;
    validateDatasetS3(params: {
        s3_url: string;
        s3_access_key_id: string;
        s3_secret_access_key: string;
        s3_region: string;
    }): Promise<any>;
    listEvaluations(options?: {
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getEvaluation(evaluationId: string): Promise<any>;
    createEvaluation(params: {
        name?: string;
        user_model_id?: string;
        base_model?: string;
        dataset_id: string;
        evaluator_ids: string[];
        max_samples?: number;
    }): Promise<any>;
    cancelEvaluation(evaluationId: string): Promise<any>;
    retryEvaluation(evaluationId: string): Promise<any>;
    getEvaluationStatus(evaluationId: string): Promise<any>;
    listEvaluators(): Promise<any>;
    estimateEvaluation(params: {
        user_model_id?: string;
        base_model?: string;
        dataset_id: string;
        evaluator_ids: string[];
        max_samples?: number;
    }): Promise<any>;
    listInferenceModels(): Promise<any>;
    getInferenceUsage(options?: {
        start_date?: string;
        end_date?: string;
        model?: string;
    }): Promise<any>;
    getInferenceJwt(): Promise<any>;
    getInferenceToken(): Promise<any>;
    listAgents(): Promise<any>;
    getAgent(agentId: string): Promise<any>;
    listTraces(options?: {
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getTrace(runId: string): Promise<any>;
    createTrace(params: Record<string, any>): Promise<any>;
    listPolicyDecisions(options?: {
        decision_action?: string;
        policy_action?: string;
        evaluation_mode?: string;
        run_id?: string;
        request_id?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getPolicyDecision(id: string): Promise<any>;
    listApprovals(options?: {
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getApproval(id: string): Promise<any>;
    approveApproval(id: string): Promise<any>;
    denyApproval(id: string): Promise<any>;
    listTenantResource(resource: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getTenantResource(resource: string, id: string): Promise<any>;
    createTenantResource(resource: string, params: Record<string, any>): Promise<any>;
    updateTenantResource(resource: string, id: string, params: Record<string, any>): Promise<any>;
    deleteTenantResource(resource: string, id: string): Promise<any>;
    testGovernancePolicy(id: string, context: Record<string, any>): Promise<any>;
    getTenantTeam(): Promise<any>;
    inviteTenantMember(params: {
        email: string;
        role?: string | number;
    }): Promise<any>;
    updateTenantMember(id: string, params: {
        inference_role_id?: string | null;
    }): Promise<any>;
    deleteTenantMember(id: string): Promise<any>;
    setTenantMemberEnabled(id: string, enabled: boolean): Promise<any>;
    cancelTenantInvitation(id: string): Promise<any>;
    updateTenantDomains(domains: string[]): Promise<any>;
    getInferenceCaptureConfig(): Promise<any>;
    updateInferenceCaptureConfig(params: Record<string, any>): Promise<any>;
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