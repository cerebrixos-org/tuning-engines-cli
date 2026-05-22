import * as https from "https";
import * as http from "http";
import { URL } from "url";
import { USER_AGENT } from "./version";

export interface ClientOptions {
  apiKey: string;
  apiUrl: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export class TuningEnginesClient {
  private apiKey: string;
  private apiUrl: string;
  private apiAccessToken?: string;
  private apiAccessTokenExpiresAt = 0;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl.replace(/\/$/, "");
  }

  // --- Jobs ---

  async listJobs(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    return this.request("GET", `/api/v1/jobs${qs ? `?${qs}` : ""}`);
  }

  async getJob(jobId: string): Promise<any> {
    return this.request("GET", `/api/v1/jobs/${jobId}`);
  }

  async createJob(params: {
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
  }): Promise<any> {
    return this.request("POST", "/api/v1/jobs", params);
  }

  async cancelJob(jobId: string): Promise<any> {
    return this.request("POST", `/api/v1/jobs/${jobId}/cancel`);
  }

  async getJobStatus(jobId: string): Promise<any> {
    return this.request("GET", `/api/v1/jobs/${jobId}/status`);
  }

  async retryJob(jobId: string, githubToken?: string): Promise<any> {
    const body: Record<string, string> = {};
    if (githubToken) body.github_token = githubToken;
    return this.request("POST", `/api/v1/jobs/${jobId}/retry`, Object.keys(body).length ? body : undefined);
  }

  async estimateJob(params: {
    base_model?: string;
    num_epochs?: number;
    max_examples?: number;
    repo_size_mb?: number;
    base_user_model_id?: string;
    use_case?: string;
  }): Promise<any> {
    return this.request("POST", "/api/v1/jobs/estimate", params);
  }

  // --- User Models ---

  async listUserModels(): Promise<any> {
    return this.request("GET", "/api/v1/user_models");
  }

  async getUserModel(modelId: string): Promise<any> {
    return this.request("GET", `/api/v1/user_models/${modelId}`);
  }

  async deleteUserModel(modelId: string): Promise<any> {
    return this.request("DELETE", `/api/v1/user_models/${modelId}`);
  }

  async getUserModelStatus(modelId: string): Promise<any> {
    return this.request("GET", `/api/v1/user_models/${modelId}/status`);
  }

  async importModel(params: {
    name: string;
    source_s3_url: string;
    base_model: string;
    s3_access_key_id: string;
    s3_secret_access_key: string;
    s3_region: string;
  }): Promise<any> {
    return this.request("POST", "/api/v1/user_models/import", params);
  }

  async exportModel(
    modelId: string,
    params: {
      s3_bucket: string;
      s3_prefix?: string;
      s3_access_key_id: string;
      s3_secret_access_key: string;
      s3_region: string;
      delete_after?: boolean;
    }
  ): Promise<any> {
    return this.request(
      "POST",
      `/api/v1/user_models/${modelId}/export`,
      params
    );
  }

  // --- Catalog (Marketplace) ---

  async listCatalogModels(options?: {
    category?: string;
    limit?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.category) params.set("category", options.category);
    if (options?.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    return this.request("GET", `/api/v1/catalog${qs ? `?${qs}` : ""}`);
  }

  async getCatalogModel(modelId: string): Promise<any> {
    return this.request("GET", `/api/v1/catalog/${modelId}`);
  }

  async exportCatalogModel(
    modelId: string,
    params: {
      s3_bucket: string;
      s3_prefix?: string;
      s3_access_key_id: string;
      s3_secret_access_key: string;
      s3_region: string;
    }
  ): Promise<any> {
    return this.request(
      "POST",
      `/api/v1/catalog/${modelId}/export`,
      params
    );
  }

  async getCatalogExportStatus(modelId: string, exportId: string): Promise<any> {
    return this.request("GET", `/api/v1/catalog/${modelId}/export/${exportId}/status`);
  }

  // --- S3 Validation ---

  async validateS3(params: {
    s3_bucket: string;
    s3_access_key_id: string;
    s3_secret_access_key: string;
    s3_region: string;
  }): Promise<any> {
    return this.request("POST", "/api/v1/jobs/validate_s3", params);
  }

  // --- Supported Models ---

  async listModels(options?: { agent?: string }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.agent) params.set("agent", options.agent);
    const qs = params.toString();
    return this.request("GET", `/api/v1/models${qs ? `?${qs}` : ""}`);
  }

  // --- Billing ---

  async getBilling(): Promise<any> {
    return this.request("GET", "/api/v1/billing");
  }

  // --- Account ---

  async getAccount(): Promise<any> {
    return this.request("GET", "/api/v1/account");
  }

  // --- Datasets ---

  async listDatasets(options?: {
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    return this.request("GET", `/api/v1/datasets${qs ? `?${qs}` : ""}`);
  }

  async getDataset(datasetId: string): Promise<any> {
    return this.request("GET", `/api/v1/datasets/${datasetId}`);
  }

  async createDataset(params: {
    name: string;
    description?: string;
    source_type: string;
    s3_url?: string;
    s3_access_key_id?: string;
    s3_secret_access_key?: string;
    s3_region?: string;
    for_evaluation?: boolean;
  }): Promise<any> {
    return this.request("POST", "/api/v1/datasets", params);
  }

  async updateDataset(
    datasetId: string,
    params: {
      name?: string;
      description?: string;
    }
  ): Promise<any> {
    return this.request("PATCH", `/api/v1/datasets/${datasetId}`, params);
  }

  async deleteDataset(datasetId: string): Promise<any> {
    return this.request("DELETE", `/api/v1/datasets/${datasetId}`);
  }

  async getDatasetStatus(datasetId: string): Promise<any> {
    return this.request("GET", `/api/v1/datasets/${datasetId}/status`);
  }

  async validateDatasetS3(params: {
    s3_url: string;
    s3_access_key_id: string;
    s3_secret_access_key: string;
    s3_region: string;
  }): Promise<any> {
    return this.request("POST", "/api/v1/datasets/validate_s3", params);
  }

  // --- Evaluations ---

  async listEvaluations(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    return this.request("GET", `/api/v1/evaluations${qs ? `?${qs}` : ""}`);
  }

  async getEvaluation(evaluationId: string): Promise<any> {
    return this.request("GET", `/api/v1/evaluations/${evaluationId}`);
  }

  async createEvaluation(params: {
    name?: string;
    user_model_id?: string;
    base_model?: string;
    dataset_id: string;
    evaluator_ids: string[];
    max_samples?: number;
  }): Promise<any> {
    return this.request("POST", "/api/v1/evaluations", params);
  }

  async cancelEvaluation(evaluationId: string): Promise<any> {
    return this.request("POST", `/api/v1/evaluations/${evaluationId}/cancel`);
  }

  async retryEvaluation(evaluationId: string): Promise<any> {
    return this.request("POST", `/api/v1/evaluations/${evaluationId}/retry`);
  }

  async getEvaluationStatus(evaluationId: string): Promise<any> {
    return this.request("GET", `/api/v1/evaluations/${evaluationId}/status`);
  }

  async listEvaluators(): Promise<any> {
    return this.request("GET", "/api/v1/evaluations/evaluators");
  }

  async estimateEvaluation(params: {
    user_model_id?: string;
    base_model?: string;
    dataset_id: string;
    evaluator_ids: string[];
    max_samples?: number;
  }): Promise<any> {
    return this.request("POST", "/api/v1/evaluations/estimate", params);
  }

  // --- Inference ---

  async listInferenceModels(): Promise<any> {
    return this.request("GET", "/api/v1/inference/models");
  }

  async getInferenceUsage(options?: {
    start_date?: string;
    end_date?: string;
    model?: string;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.start_date) params.set("start_date", options.start_date);
    if (options?.end_date) params.set("end_date", options.end_date);
    if (options?.model) params.set("model", options.model);
    const qs = params.toString();
    return this.request("GET", `/api/v1/inference/usage${qs ? `?${qs}` : ""}`);
  }

  async getInferenceJwt(): Promise<any> {
    return this.request("POST", "/api/v1/inference/jwt");
  }

  async getInferenceToken(): Promise<any> {
    return this.requestWithBearer("POST", "/api/v1/inference/token", this.apiKey);
  }

  // --- Agents ---

  async listAgents(): Promise<any> {
    return this.request("GET", "/api/v1/agents");
  }

  async getAgent(agentId: string): Promise<any> {
    return this.request("GET", `/api/v1/agents/${agentId}`);
  }

  // --- Runtime traces ---

  async listTraces(options?: { limit?: number; offset?: number }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    return this.request("GET", `/api/v1/traces${qs ? `?${qs}` : ""}`);
  }

  async getTrace(runId: string): Promise<any> {
    return this.request("GET", `/api/v1/traces/${encodeURIComponent(runId)}`);
  }

  async createTrace(params: Record<string, any>): Promise<any> {
    return this.request("POST", "/api/v1/traces", params);
  }

  // --- Policy decisions ---

  async listPolicyDecisions(options?: {
    decision_action?: string;
    policy_action?: string;
    evaluation_mode?: string;
    run_id?: string;
    request_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.decision_action) params.set("decision_action", options.decision_action);
    if (options?.policy_action) params.set("policy_action", options.policy_action);
    if (options?.evaluation_mode) params.set("evaluation_mode", options.evaluation_mode);
    if (options?.run_id) params.set("run_id", options.run_id);
    if (options?.request_id) params.set("request_id", options.request_id);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    return this.request("GET", `/api/v1/policy_decisions${qs ? `?${qs}` : ""}`);
  }

  async getPolicyDecision(id: string): Promise<any> {
    return this.request("GET", `/api/v1/policy_decisions/${encodeURIComponent(id)}`);
  }

  // --- Policy templates and drafts ---

  async listPolicyTemplates(): Promise<any> {
    return this.request("GET", "/api/v1/policy_templates");
  }

  async renderPolicyTemplate(id: string, templateParams?: Record<string, any>): Promise<any> {
    return this.request("POST", `/api/v1/policy_templates/${encodeURIComponent(id)}/render`, {
      template_params: templateParams || {},
    });
  }

  async generatePolicyDraft(params: { prompt: string; scope?: string }): Promise<any> {
    return this.request("POST", "/api/v1/policy_drafts/generate", params);
  }

  // --- Approval requests ---

  async listApprovals(options?: { status?: string; limit?: number; offset?: number }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    return this.request("GET", `/api/v1/approvals${qs ? `?${qs}` : ""}`);
  }

  async getApproval(id: string): Promise<any> {
    return this.request("GET", `/api/v1/approvals/${encodeURIComponent(id)}`);
  }

  async approveApproval(id: string): Promise<any> {
    return this.request("POST", `/api/v1/approvals/${encodeURIComponent(id)}/approve`);
  }

  async denyApproval(id: string): Promise<any> {
    return this.request("POST", `/api/v1/approvals/${encodeURIComponent(id)}/deny`);
  }

  // --- Tenant admin automation resources ---

  async listTenantResource(resource: string, options?: { limit?: number; offset?: number }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    return this.request("GET", `/api/v1/tenant/${encodeURIComponent(resource)}${qs ? `?${qs}` : ""}`);
  }

  async getTenantResource(resource: string, id: string): Promise<any> {
    return this.request("GET", `/api/v1/tenant/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`);
  }

  async createTenantResource(resource: string, params: Record<string, any>): Promise<any> {
    return this.request("POST", `/api/v1/tenant/${encodeURIComponent(resource)}`, params);
  }

  async updateTenantResource(resource: string, id: string, params: Record<string, any>): Promise<any> {
    return this.request("PATCH", `/api/v1/tenant/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, params);
  }

  async deleteTenantResource(resource: string, id: string): Promise<any> {
    return this.request("DELETE", `/api/v1/tenant/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`);
  }

  async validateTenantResource(resource: string, params: Record<string, any>): Promise<any> {
    return this.request("POST", `/api/v1/tenant/${encodeURIComponent(resource)}/validate`, params);
  }

  async testGovernancePolicy(id: string, context: Record<string, any>): Promise<any> {
    return this.request("POST", `/api/v1/tenant/governance_policies/${encodeURIComponent(id)}/test`, { context });
  }

  async getTenantTeam(): Promise<any> {
    return this.request("GET", "/api/v1/tenant/team");
  }

  async inviteTenantMember(params: { email: string; role?: string | number }): Promise<any> {
    return this.request("POST", "/api/v1/tenant/team/invitations", params);
  }

  async updateTenantMember(id: string, params: { inference_role_id?: string | null }): Promise<any> {
    return this.request("PATCH", `/api/v1/tenant/team/members/${encodeURIComponent(id)}`, params);
  }

  async deleteTenantMember(id: string): Promise<any> {
    return this.request("DELETE", `/api/v1/tenant/team/members/${encodeURIComponent(id)}`);
  }

  async setTenantMemberEnabled(id: string, enabled: boolean): Promise<any> {
    return this.request("POST", `/api/v1/tenant/team/members/${encodeURIComponent(id)}/${enabled ? "enable" : "disable"}`);
  }

  async cancelTenantInvitation(id: string): Promise<any> {
    return this.request("DELETE", `/api/v1/tenant/team/invitations/${encodeURIComponent(id)}`);
  }

  async updateTenantDomains(domains: string[]): Promise<any> {
    return this.request("PATCH", "/api/v1/tenant/team/domains", { allowed_email_domains: domains });
  }

  async getInferenceCaptureConfig(): Promise<any> {
    return this.request("GET", "/api/v1/tenant/inference_capture");
  }

  async updateInferenceCaptureConfig(params: Record<string, any>): Promise<any> {
    return this.request("PATCH", "/api/v1/tenant/inference_capture", params);
  }

  // --- Device Auth (unauthenticated) ---

  static async createDeviceSession(
    apiUrl: string
  ): Promise<{
    device_code: string;
    verification_url: string;
    expires_in: number;
    poll_interval: number;
  }> {
    return TuningEnginesClient.requestNoAuth(apiUrl, "POST", "/api/v1/auth/device");
  }

  static async pollDeviceSession(
    apiUrl: string,
    deviceCode: string
  ): Promise<{ status: string; api_token?: string }> {
    return TuningEnginesClient.requestNoAuth(
      apiUrl,
      "GET",
      `/api/v1/auth/device/poll?device_code=${encodeURIComponent(deviceCode)}`
    );
  }

  private static requestNoAuth(
    apiUrl: string,
    method: string,
    path: string,
    body?: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const baseUrl = apiUrl.replace(/\/$/, "");
      const url = new URL(path, baseUrl);
      const isHttps = url.protocol === "https:";
      const transport = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      };

      const req = transport.request(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              const error =
                parsed.error || { code: "unknown", message: data };
              reject(
                new Error(
                  `API Error (${res.statusCode}): ${error.message || JSON.stringify(error)}`
                )
              );
            } else {
              resolve(parsed);
            }
          } catch {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`API Error (${res.statusCode}): ${data}`));
            } else {
              resolve(data);
            }
          }
        });
      });

      req.on("error", reject);

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  // --- HTTP ---

  private request(
    method: string,
    path: string,
    body?: Record<string, any>
  ): Promise<any> {
    return this.getApiAccessToken().then((token) =>
      this.requestWithBearer(method, path, token, body)
    );
  }

  private async getApiAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.apiAccessToken && this.apiAccessTokenExpiresAt - now > 60) {
      return this.apiAccessToken;
    }

    const response = await this.requestWithBearer("POST", "/api/v1/auth/token", this.apiKey);
    const token = response.access_token as string | undefined;
    if (!token) {
      throw new Error("API Error: authentication token exchange did not return an access token");
    }

    const expiresIn = Number(response.expires_in || 900);
    this.apiAccessToken = token;
    this.apiAccessTokenExpiresAt = now + expiresIn;
    return token;
  }

  private requestWithBearer(
    method: string,
    path: string,
    bearerToken: string,
    body?: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.apiUrl);
      const isHttps = url.protocol === "https:";
      const transport = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      };

      const req = transport.request(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              const error =
                parsed.error || { code: "unknown", message: data };
              reject(
                new Error(
                  `API Error (${res.statusCode}): ${error.message || JSON.stringify(error)}`
                )
              );
            } else {
              resolve(parsed);
            }
          } catch {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`API Error (${res.statusCode}): ${data}`));
            } else {
              resolve(data);
            }
          }
        });
      });

      req.on("error", reject);

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}
