"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TuningEnginesClient = void 0;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const url_1 = require("url");
class TuningEnginesClient {
    apiKey;
    apiUrl;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.apiUrl = options.apiUrl.replace(/\/$/, "");
    }
    // --- Jobs ---
    async listJobs(options) {
        const params = new URLSearchParams();
        if (options?.status)
            params.set("status", options.status);
        if (options?.limit)
            params.set("limit", String(options.limit));
        if (options?.offset)
            params.set("offset", String(options.offset));
        const qs = params.toString();
        return this.request("GET", `/api/v1/jobs${qs ? `?${qs}` : ""}`);
    }
    async getJob(jobId) {
        return this.request("GET", `/api/v1/jobs/${jobId}`);
    }
    async createJob(params) {
        return this.request("POST", "/api/v1/jobs", params);
    }
    async cancelJob(jobId) {
        return this.request("POST", `/api/v1/jobs/${jobId}/cancel`);
    }
    async getJobStatus(jobId) {
        return this.request("GET", `/api/v1/jobs/${jobId}/status`);
    }
    async retryJob(jobId, githubToken) {
        const body = {};
        if (githubToken)
            body.github_token = githubToken;
        return this.request("POST", `/api/v1/jobs/${jobId}/retry`, Object.keys(body).length ? body : undefined);
    }
    async estimateJob(params) {
        return this.request("POST", "/api/v1/jobs/estimate", params);
    }
    // --- User Models ---
    async listUserModels() {
        return this.request("GET", "/api/v1/user_models");
    }
    async getUserModel(modelId) {
        return this.request("GET", `/api/v1/user_models/${modelId}`);
    }
    async deleteUserModel(modelId) {
        return this.request("DELETE", `/api/v1/user_models/${modelId}`);
    }
    async getUserModelStatus(modelId) {
        return this.request("GET", `/api/v1/user_models/${modelId}/status`);
    }
    async importModel(params) {
        return this.request("POST", "/api/v1/user_models/import", params);
    }
    async exportModel(modelId, params) {
        return this.request("POST", `/api/v1/user_models/${modelId}/export`, params);
    }
    // --- Catalog (Marketplace) ---
    async listCatalogModels(options) {
        const params = new URLSearchParams();
        if (options?.category)
            params.set("category", options.category);
        if (options?.limit)
            params.set("limit", String(options.limit));
        const qs = params.toString();
        return this.request("GET", `/api/v1/catalog${qs ? `?${qs}` : ""}`);
    }
    async getCatalogModel(modelId) {
        return this.request("GET", `/api/v1/catalog/${modelId}`);
    }
    async exportCatalogModel(modelId, params) {
        return this.request("POST", `/api/v1/catalog/${modelId}/export`, params);
    }
    async getCatalogExportStatus(modelId, exportId) {
        return this.request("GET", `/api/v1/catalog/${modelId}/export/${exportId}/status`);
    }
    // --- S3 Validation ---
    async validateS3(params) {
        return this.request("POST", "/api/v1/jobs/validate_s3", params);
    }
    // --- Supported Models ---
    async listModels(options) {
        const params = new URLSearchParams();
        if (options?.agent)
            params.set("agent", options.agent);
        const qs = params.toString();
        return this.request("GET", `/api/v1/models${qs ? `?${qs}` : ""}`);
    }
    // --- Billing ---
    async getBilling() {
        return this.request("GET", "/api/v1/billing");
    }
    // --- Account ---
    async getAccount() {
        return this.request("GET", "/api/v1/account");
    }
    // --- Datasets ---
    async listDatasets(options) {
        const params = new URLSearchParams();
        if (options?.limit)
            params.set("limit", String(options.limit));
        if (options?.offset)
            params.set("offset", String(options.offset));
        const qs = params.toString();
        return this.request("GET", `/api/v1/datasets${qs ? `?${qs}` : ""}`);
    }
    async getDataset(datasetId) {
        return this.request("GET", `/api/v1/datasets/${datasetId}`);
    }
    async createDataset(params) {
        return this.request("POST", "/api/v1/datasets", params);
    }
    async updateDataset(datasetId, params) {
        return this.request("PATCH", `/api/v1/datasets/${datasetId}`, params);
    }
    async deleteDataset(datasetId) {
        return this.request("DELETE", `/api/v1/datasets/${datasetId}`);
    }
    async getDatasetStatus(datasetId) {
        return this.request("GET", `/api/v1/datasets/${datasetId}/status`);
    }
    async validateDatasetS3(params) {
        return this.request("POST", "/api/v1/datasets/validate_s3", params);
    }
    // --- Evaluations ---
    async listEvaluations(options) {
        const params = new URLSearchParams();
        if (options?.status)
            params.set("status", options.status);
        if (options?.limit)
            params.set("limit", String(options.limit));
        if (options?.offset)
            params.set("offset", String(options.offset));
        const qs = params.toString();
        return this.request("GET", `/api/v1/evaluations${qs ? `?${qs}` : ""}`);
    }
    async getEvaluation(evaluationId) {
        return this.request("GET", `/api/v1/evaluations/${evaluationId}`);
    }
    async createEvaluation(params) {
        return this.request("POST", "/api/v1/evaluations", params);
    }
    async cancelEvaluation(evaluationId) {
        return this.request("POST", `/api/v1/evaluations/${evaluationId}/cancel`);
    }
    async retryEvaluation(evaluationId) {
        return this.request("POST", `/api/v1/evaluations/${evaluationId}/retry`);
    }
    async getEvaluationStatus(evaluationId) {
        return this.request("GET", `/api/v1/evaluations/${evaluationId}/status`);
    }
    async listEvaluators() {
        return this.request("GET", "/api/v1/evaluations/evaluators");
    }
    async estimateEvaluation(params) {
        return this.request("POST", "/api/v1/evaluations/estimate", params);
    }
    // --- Inference ---
    async listInferenceModels() {
        return this.request("GET", "/api/v1/inference/models");
    }
    async getInferenceUsage(options) {
        const params = new URLSearchParams();
        if (options?.start_date)
            params.set("start_date", options.start_date);
        if (options?.end_date)
            params.set("end_date", options.end_date);
        if (options?.model)
            params.set("model", options.model);
        const qs = params.toString();
        return this.request("GET", `/api/v1/inference/usage${qs ? `?${qs}` : ""}`);
    }
    async getInferenceJwt() {
        return this.request("POST", "/api/v1/inference/jwt");
    }
    // --- Agents ---
    async listAgents() {
        return this.request("GET", "/api/v1/agents");
    }
    async getAgent(agentId) {
        return this.request("GET", `/api/v1/agents/${agentId}`);
    }
    // --- Tenant admin automation resources ---
    async listTenantResource(resource, options) {
        const params = new URLSearchParams();
        if (options?.limit)
            params.set("limit", String(options.limit));
        if (options?.offset)
            params.set("offset", String(options.offset));
        const qs = params.toString();
        return this.request("GET", `/api/v1/tenant/${encodeURIComponent(resource)}${qs ? `?${qs}` : ""}`);
    }
    async getTenantResource(resource, id) {
        return this.request("GET", `/api/v1/tenant/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`);
    }
    async createTenantResource(resource, params) {
        return this.request("POST", `/api/v1/tenant/${encodeURIComponent(resource)}`, params);
    }
    async updateTenantResource(resource, id, params) {
        return this.request("PATCH", `/api/v1/tenant/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, params);
    }
    async deleteTenantResource(resource, id) {
        return this.request("DELETE", `/api/v1/tenant/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`);
    }
    async testGovernancePolicy(id, context) {
        return this.request("POST", `/api/v1/tenant/governance_policies/${encodeURIComponent(id)}/test`, { context });
    }
    async getTenantTeam() {
        return this.request("GET", "/api/v1/tenant/team");
    }
    async inviteTenantMember(params) {
        return this.request("POST", "/api/v1/tenant/team/invitations", params);
    }
    async updateTenantMember(id, params) {
        return this.request("PATCH", `/api/v1/tenant/team/members/${encodeURIComponent(id)}`, params);
    }
    async deleteTenantMember(id) {
        return this.request("DELETE", `/api/v1/tenant/team/members/${encodeURIComponent(id)}`);
    }
    async setTenantMemberEnabled(id, enabled) {
        return this.request("POST", `/api/v1/tenant/team/members/${encodeURIComponent(id)}/${enabled ? "enable" : "disable"}`);
    }
    async cancelTenantInvitation(id) {
        return this.request("DELETE", `/api/v1/tenant/team/invitations/${encodeURIComponent(id)}`);
    }
    async updateTenantDomains(domains) {
        return this.request("PATCH", "/api/v1/tenant/team/domains", { allowed_email_domains: domains });
    }
    async getInferenceCaptureConfig() {
        return this.request("GET", "/api/v1/tenant/inference_capture");
    }
    async updateInferenceCaptureConfig(params) {
        return this.request("PATCH", "/api/v1/tenant/inference_capture", params);
    }
    // --- Device Auth (unauthenticated) ---
    static async createDeviceSession(apiUrl) {
        return TuningEnginesClient.requestNoAuth(apiUrl, "POST", "/api/v1/auth/device");
    }
    static async pollDeviceSession(apiUrl, deviceCode) {
        return TuningEnginesClient.requestNoAuth(apiUrl, "GET", `/api/v1/auth/device/poll?device_code=${encodeURIComponent(deviceCode)}`);
    }
    static requestNoAuth(apiUrl, method, path, body) {
        return new Promise((resolve, reject) => {
            const baseUrl = apiUrl.replace(/\/$/, "");
            const url = new url_1.URL(path, baseUrl);
            const isHttps = url.protocol === "https:";
            const transport = isHttps ? https : http;
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "User-Agent": "tuning-engines-cli/0.3.5",
                },
            };
            const req = transport.request(options, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk.toString();
                });
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode && res.statusCode >= 400) {
                            const error = parsed.error || { code: "unknown", message: data };
                            reject(new Error(`API Error (${res.statusCode}): ${error.message || JSON.stringify(error)}`));
                        }
                        else {
                            resolve(parsed);
                        }
                    }
                    catch {
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(`API Error (${res.statusCode}): ${data}`));
                        }
                        else {
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
    request(method, path, body) {
        return new Promise((resolve, reject) => {
            const url = new url_1.URL(path, this.apiUrl);
            const isHttps = url.protocol === "https:";
            const transport = isHttps ? https : http;
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "User-Agent": "tuning-engines-cli/0.3.5",
                },
            };
            const req = transport.request(options, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk.toString();
                });
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode && res.statusCode >= 400) {
                            const error = parsed.error || { code: "unknown", message: data };
                            reject(new Error(`API Error (${res.statusCode}): ${error.message || JSON.stringify(error)}`));
                        }
                        else {
                            resolve(parsed);
                        }
                    }
                    catch {
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(`API Error (${res.statusCode}): ${data}`));
                        }
                        else {
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
exports.TuningEnginesClient = TuningEnginesClient;
//# sourceMappingURL=client.js.map