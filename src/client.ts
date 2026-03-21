import * as https from "https";
import * as http from "http";
import { URL } from "url";

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
          "User-Agent": "tuning-engines-cli/0.3.5",
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
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "tuning-engines-cli/0.3.5",
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
