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
    private apiAccessToken?;
    private apiAccessTokenExpiresAt;
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
    listUserModels(options?: {
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getUserModel(id: string): Promise<any>;
    deleteUserModel(id: string): Promise<any>;
    getUserModelStatus(id: string): Promise<any>;
    importUserModel(params: Record<string, any>): Promise<any>;
    exportUserModel(id: string, params?: Record<string, any>): Promise<any>;
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
        user_id?: string;
        range?: string;
        limit?: number;
    }): Promise<any>;
    getInferenceUsageAnalytics(options?: {
        view?: string;
        range?: string;
        start_date?: string;
        end_date?: string;
        model?: string;
        user_id?: string;
        limit?: number;
        page?: number;
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
    resolveContext(params: {
        query: string;
        context_asset_ids?: string[];
        goal_key?: string;
        entities?: string[];
        action?: string;
        sensitivity?: string;
        request_id?: string;
        run_id?: string;
    }): Promise<any>;
    createOutcomeContext(params: {
        title: string;
        outcome_key?: string;
        context_id?: string;
    }): Promise<any>;
    completeOutcomeContext(params: {
        context_id: string;
        result_status?: string;
    }): Promise<any>;
    completeWorkItem(id: string): Promise<any>;
    listWorkItems(options?: {
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<any>;
    getWorkItem(id: string): Promise<any>;
    confirmWorkItemOutcome(id: string, params: {
        inference_outcome_id: number;
        result_status?: string;
        label?: string;
    }): Promise<any>;
    previewWorkItemRepair(id: string, params: Record<string, any>): Promise<any>;
    applyWorkItemRepair(id: string, params: Record<string, any>): Promise<any>;
    undoWorkItemRepair(id: string, params: Record<string, any>): Promise<any>;
    previewWorkItemBulkOperation(params: Record<string, any>): Promise<any>;
    applyWorkItemBulkOperation(id: string): Promise<any>;
    createOutcomeProposal(params: Record<string, any>): Promise<any>;
    approveOutcomeProposal(id: string): Promise<any>;
    createOutcomeAlias(params: Record<string, any>): Promise<any>;
    mergeOutcomes(params: Record<string, any>): Promise<any>;
    listInferenceFeedback(options?: {
        limit?: number;
        offset?: number;
    }): Promise<any>;
    createInferenceFeedback(params: Record<string, any>): Promise<any>;
    listInitiatives(options?: {
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getInitiative(id: string): Promise<any>;
    createInitiative(params: {
        title: string;
        description?: string;
    }): Promise<any>;
    updateInitiative(id: string, params: {
        title?: string;
        description?: string;
        status?: string;
    }): Promise<any>;
    listOutcomes(options?: {
        range?: string;
    }): Promise<any>;
    createOutcomeMappingRule(params: Record<string, any>): Promise<any>;
    listInsights(options?: {
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getInsight(id: string): Promise<any>;
    acceptInsight(id: string): Promise<any>;
    applyInsight(id: string): Promise<any>;
    doctorSimulate(params: Record<string, any>): Promise<any>;
    createTrace(params: Record<string, any>): Promise<any>;
    evaluateAgentAction(params: Record<string, any>): Promise<any>;
    listRuntimeInterventions(options?: {
        runId?: string;
        status?: string;
        kind?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    createRuntimeIntervention(runId: string, params: {
        kind: string;
        reason?: string;
        target_event_id?: string;
        expires_at?: string;
        metadata?: Record<string, any>;
        request_context?: Record<string, any>;
    }): Promise<any>;
    getRuntimeIntervention(id: string): Promise<any>;
    ackRuntimeIntervention(id: string, metadata?: Record<string, any>): Promise<any>;
    completeRuntimeIntervention(id: string, metadata?: Record<string, any>): Promise<any>;
    failRuntimeIntervention(id: string, metadata?: Record<string, any>): Promise<any>;
    listRuntimeStateReferences(options?: {
        runId?: string;
        referenceType?: string;
        provider?: string;
        resourceType?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    upsertRuntimeStateReference(params: Record<string, any>): Promise<any>;
    getRuntimeStateReference(id: string): Promise<any>;
    listAiSystemAssets(options?: {
        assetType?: string;
        sourceSystem?: string;
        lifecycleState?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getAiSystemAsset(id: string): Promise<any>;
    listEvidenceSets(options?: {
        initiativeId?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getEvidenceSet(id: string): Promise<any>;
    createEvidenceSet(params: {
        initiative_id: string;
        work_item_ids: string[];
        name?: string;
        filter_snapshot?: Record<string, any>;
    }): Promise<any>;
    previewEvidenceSet(params: {
        initiative_id: string;
        work_item_ids: string[];
    }): Promise<any>;
    listTrajectorySelectionRules(options?: {
        initiativeId?: string;
    }): Promise<any>;
    createTrajectorySelectionRule(params: Record<string, any>): Promise<any>;
    previewTrajectorySelectionRule(id: string): Promise<any>;
    freezeTrajectorySelectionRule(id: string, name?: string): Promise<any>;
    recordContextUse(params: Record<string, any>): Promise<any>;
    listIntelligenceRuns(options?: {
        runType?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getIntelligenceRun(id: string): Promise<any>;
    createIntelligenceRun(params: {
        initiative_id: string;
        run_type: string;
        evidence_set_id?: string;
        parameters?: Record<string, any>;
    }): Promise<any>;
    listContextAssets(options?: {
        contextType?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getContextAsset(id: string): Promise<any>;
    createContextAsset(params: Record<string, any>): Promise<any>;
    reviewContextAsset(id: string, versionId: string, validationPacket?: Record<string, any>): Promise<any>;
    activateContextAsset(id: string, versionId: string): Promise<any>;
    dryRunRegistrySync(manifest: Record<string, any>): Promise<any>;
    applyRegistrySync(manifest: Record<string, any>): Promise<any>;
    getRegistrySync(id: string): Promise<any>;
    listComplianceRisks(options?: {
        status?: string;
        category?: string;
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getComplianceRisk(id: string): Promise<any>;
    createComplianceRisk(params: Record<string, any>): Promise<any>;
    updateComplianceRisk(id: string, params: Record<string, any>): Promise<any>;
    assessComplianceRisk(id: string, params: Record<string, any>): Promise<any>;
    mapComplianceRiskControl(id: string, params: Record<string, any>): Promise<any>;
    addComplianceRiskSubject(id: string, subject: string): Promise<any>;
    removeComplianceRiskSubject(id: string, subjectId: string): Promise<any>;
    createComplianceSourceRun(params: Record<string, any>): Promise<any>;
    getComplianceSourceRun(id: string): Promise<any>;
    submitComplianceSourceResults(id: string, params: Record<string, any>): Promise<any>;
    completeComplianceSourceRun(id: string, completeness: string): Promise<any>;
    validateCompliance(params: Record<string, any>): Promise<any>;
    rewriteCompliance(params: Record<string, any>): Promise<any>;
    getComplianceEvidence(id: string): Promise<any>;
    createComplianceCertification(params: Record<string, any>): Promise<any>;
    getComplianceCertification(id: string): Promise<any>;
    listBulkImports(options?: {
        limit?: number;
        offset?: number;
    }): Promise<any>;
    getBulkImport(id: string): Promise<any>;
    createBulkImport(params: {
        target_type: string;
        rows: Record<string, any>[];
        dry_run?: boolean;
    }): Promise<any>;
    listFiles(options?: {
        purpose?: string;
        limit?: number;
    }): Promise<any>;
    getFile(id: string): Promise<any>;
    uploadFile(filePath: string, options?: {
        purpose?: string;
        contentType?: string;
    }): Promise<any>;
    downloadFileContent(id: string): Promise<Buffer>;
    deleteFile(id: string): Promise<any>;
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
    listPolicyTemplates(): Promise<any>;
    renderPolicyTemplate(id: string, templateParams?: Record<string, any>): Promise<any>;
    generatePolicyDraft(params: {
        prompt: string;
        scope?: string;
    }): Promise<any>;
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
    validateTenantResource(resource: string, params: Record<string, any>): Promise<any>;
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
    flushInferenceCapture(): Promise<any>;
    retryTenantResourceSync(resource: string, id: string): Promise<any>;
    verifyTenantResource(resource: string, id: string): Promise<any>;
    listMcpTools(serverId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<any>;
    listGatewayTools(): Promise<any>;
    callGatewayTool(toolName: string, args: Record<string, any>): Promise<any>;
    rediscoverMcpServer(serverId: string): Promise<any>;
    updateMcpTool(serverId: string, toolId: string, params: {
        enabled?: boolean;
    }): Promise<any>;
    toggleMcpTool(serverId: string, toolId: string): Promise<any>;
    listMcpTemplates(): Promise<any>;
    getMcpTemplate(id: string): Promise<any>;
    installMcpTemplate(id: string, secretReferenceId?: string): Promise<any>;
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
    private getApiAccessToken;
    private requestRaw;
    private requestMultipart;
    private escapeMultipart;
    private requestWithBearer;
}
//# sourceMappingURL=client.d.ts.map