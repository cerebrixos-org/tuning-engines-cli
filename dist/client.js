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
    // --- S3 Validation ---
    async validateS3(params) {
        return this.request("POST", "/api/v1/jobs/validate_s3", params);
    }
    // --- Supported Models ---
    async listModels() {
        return this.request("GET", "/api/v1/models");
    }
    // --- Billing ---
    async getBilling() {
        return this.request("GET", "/api/v1/billing");
    }
    // --- Account ---
    async getAccount() {
        return this.request("GET", "/api/v1/account");
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