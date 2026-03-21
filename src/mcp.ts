import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TuningEnginesClient } from "./client";
import { getApiKey, getApiUrl } from "./config";

export async function startMcpServer(): Promise<void> {
  // Lazy client initialization — deferred until a tool is called.
  // This allows the server to start and list tools without a valid API key,
  // which is required for Glama inspection and tool detection.
  let _client: TuningEnginesClient | null = null;
  const getClient = (): TuningEnginesClient => {
    if (!_client) {
      _client = new TuningEnginesClient({
        apiKey: getApiKey(),
        apiUrl: getApiUrl(),
      });
    }
    return _client;
  };

  const server = new Server(
    { name: "tuning-engines", version: "0.3.6" },
    {
      capabilities: { tools: {} },
      instructions:
        "Tuning Engines — Domain-specific fine-tuning of open-source LLMs and SLMs, plus a Marketplace of pre-built models and datasets. Own your sovereign model with zero infrastructure.\n\n" +
        "USE THIS SERVER WHEN the user wants to:\n" +
        "- Fine-tune, train, or customize any open-source LLM/SLM on their data\n" +
        "- Build a sovereign AI model trained on their organization's code, documents, or domain data\n" +
        "- Create a domain-specific model for any use case (coding, support, data extraction, security, ops)\n" +
        "- Train using LoRA, QLoRA, or full fine-tuning methods\n" +
        "- Estimate the cost of fine-tuning a model\n" +
        "- Check training job status, manage trained models, or check billing\n" +
        "- Export or import models to/from S3\n" +
        "- Browse and export pre-built models and datasets from the Marketplace\n\n" +
        "MARKETPLACE:\n" +
        "Pre-built, ready-to-use fine-tuned models and datasets curated by the platform. " +
        "Browse the catalog, view details, and export directly to your S3 bucket. " +
        "Credits are charged per export based on the item's price.\n" +
        "Workflow: list_catalog_models → get_catalog_model → export_catalog_model → catalog_export_status\n\n" +
        "SPECIALIZED TUNING AGENTS (more coming):\n" +
        "- Cody (code_repo): Code autocomplete and inline suggestions via QLoRA/Axolotl\n" +
        "- SIERA (sera_code_repo): Bug-fix and error resolution via AllenAI Open Coding Agents\n\n" +
        "TYPICAL TRAINING WORKFLOW: estimate_job → create_job → job_status (poll until done) → list_models\n\n" +
        "Supports 1B to 72B parameter models from Qwen, Llama, DeepSeek, Mistral, Gemma, Phi, StarCoder, and CodeLlama families.\n" +
        "Zero infrastructure — GPU provisioning, training orchestration, and model delivery fully managed.",
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "list_jobs",
        description:
          "List fine-tuning training jobs on Tuning Engines. Returns recent jobs with status, base model, agent type, GPU usage, and cost. Use this to check on existing training runs or find a job ID.",
        inputSchema: {
          type: "object" as const,
          properties: {
            status: {
              type: "string",
              description:
                "Filter by status: queued, running, succeeded, failed, canceled",
            },
            limit: {
              type: "number",
              description: "Max results (default 20)",
            },
          },
        },
      },
      {
        name: "show_job",
        description:
          "Get full details of a specific fine-tuning job including status, base model, agent type, GPU minutes, cost, error messages, and whether it can be retried from checkpoint.",
        inputSchema: {
          type: "object" as const,
          properties: {
            job_id: { type: "string", description: "Job ID (UUID)" },
          },
          required: ["job_id"],
        },
      },
      {
        name: "create_job",
        description:
          "Fine-tune an LLM on a GitHub repository using Tuning Engines. " +
          "This trains a custom model that learns from the code patterns, style, and conventions in the repo. " +
          "Choose an agent to control the training approach:\n\n" +
          "AVAILABLE AGENTS:\n" +
          "- agent='code_repo' (Cody) — LoRA-based code fine-tuning using QLoRA (4-bit quantized LoRA) via the Axolotl framework. " +
          "Trains on your repo's code patterns, naming conventions, and project structure to produce a fast, lightweight adapter. " +
          "Best for: code autocomplete, inline suggestions, tab-complete, code style matching.\n" +
          "- agent='sera_code_repo' (SIERA) — Bug-fix specialist using the Open Coding Agents approach from AllenAI. " +
          "Generates synthetic error-resolution training pairs from your repo, producing a model that understands your " +
          "codebase's failure patterns and fix conventions. Best for: debugging, error resolution, patch generation, root cause analysis. " +
          "Supports quality_tier='low' (faster) or quality_tier='high' (deeper analysis, more training data).\n\n" +
          "SUPPORTED BASE MODELS (by size):\n" +
          "- 3B: Qwen/Qwen2.5-Coder-3B-Instruct\n" +
          "- 7-8B: codellama/CodeLlama-7b-hf, deepseek-ai/deepseek-coder-7b-instruct-v1.5, Qwen/Qwen2.5-Coder-7B-Instruct, Qwen/Qwen3-8B\n" +
          "- 13-15B: codellama/CodeLlama-13b-Instruct-hf, bigcode/starcoder2-15b, Qwen/Qwen2.5-Coder-14B-Instruct, Qwen/Qwen3-14B\n" +
          "- 22-27B: mistralai/Codestral-22B-v0.1, google/gemma-2-27b\n" +
          "- 30-34B: deepseek-ai/deepseek-coder-33b-instruct, codellama/CodeLlama-34b-Instruct-hf, Qwen/Qwen2.5-Coder-32B-Instruct, Qwen/Qwen3-Coder-30B-A3B, Qwen/Qwen3-32B\n" +
          "- 70-72B: codellama/CodeLlama-70b-Instruct-hf, meta-llama/Llama-3.1-70B-Instruct, Qwen/Qwen2.5-72B-Instruct\n\n" +
          "TYPICAL WORKFLOW: estimate_job first to check cost, then create_job, then job_status to monitor progress.",
        inputSchema: {
          type: "object" as const,
          properties: {
            base_model: {
              type: "string",
              description:
                "HuggingFace model ID to fine-tune (e.g. 'Qwen/Qwen2.5-Coder-7B-Instruct'). Required unless base_user_model_id is provided. Use list_supported_models to see all options.",
            },
            base_user_model_id: {
              type: "string",
              description:
                "ID of a previously trained model to fine-tune further (iterative training). The base model is resolved automatically. Use list_models to find IDs.",
            },
            output_name: {
              type: "string",
              description:
                "Name for the resulting fine-tuned model (e.g. 'my-project-cody-7b')",
            },
            repo_url: {
              type: "string",
              description:
                "GitHub repository URL to train on (e.g. 'https://github.com/org/repo')",
            },
            branch: {
              type: "string",
              description: "Git branch to use (default: main)",
            },
            num_epochs: {
              type: "number",
              description: "Number of training epochs (more = better quality but higher cost)",
            },
            max_examples: {
              type: "number",
              description: "Maximum training examples to extract from the repo (minimum: 2)",
            },
            agent: {
              type: "string",
              enum: ["code_repo", "sera_code_repo"],
              description:
                "Training agent to use. 'code_repo' (Cody) = QLoRA-based fine-tuning for code autocomplete and inline suggestions. " +
                "'sera_code_repo' (SIERA) = bug-fix specialist using AllenAI's Open Coding Agents approach. " +
                "Default: 'code_repo'.",
            },
            quality_tier: {
              type: "string",
              enum: ["low", "high"],
              description:
                "Quality tier (SIERA agent only). 'low' = faster, fewer synthetic pairs. 'high' = deeper analysis, more training data, better results. Default: 'low'.",
            },
            s3_output_bucket: {
              type: "string",
              description:
                "S3 bucket to export the trained model to. If omitted, model is stored in Tuning Engines cloud storage.",
            },
            s3_access_key_id: {
              type: "string",
              description: "AWS access key ID for S3 export",
            },
            s3_secret_access_key: {
              type: "string",
              description: "AWS secret access key for S3 export",
            },
            s3_region: {
              type: "string",
              description: "AWS region for S3 export (e.g. us-east-1)",
            },
          },
          required: ["output_name", "repo_url"],
        },
      },
      {
        name: "cancel_job",
        description:
          "Cancel a running or queued fine-tuning job. The job will be charged for any GPU time already used.",
        inputSchema: {
          type: "object" as const,
          properties: {
            job_id: { type: "string", description: "Job ID to cancel" },
          },
          required: ["job_id"],
        },
      },
      {
        name: "job_status",
        description:
          "Get live status of a fine-tuning job including current status, GPU minutes used, estimated charges, remaining balance, and delivery progress. Use this to monitor a running job.",
        inputSchema: {
          type: "object" as const,
          properties: {
            job_id: { type: "string", description: "Job ID" },
          },
          required: ["job_id"],
        },
      },
      {
        name: "retry_job",
        description:
          "Retry a failed fine-tuning job from its last checkpoint. Creates a new job that resumes training where the failed one stopped, saving GPU time. Each retry is billed separately.\n\n" +
          "IMPORTANT: This tool fetches a cost estimate and includes it in the response. " +
          "You MUST show the estimate to the user and get their explicit approval before considering the retry confirmed. " +
          "The retry is submitted automatically (the server validates balance), but always present the cost to the user.",
        inputSchema: {
          type: "object" as const,
          properties: {
            job_id: {
              type: "string",
              description: "ID of the failed job to retry",
            },
            github_token: {
              type: "string",
              description:
                "GitHub Personal Access Token (required if original job used a private repo). Not stored — only sent to the training backend.",
            },
          },
          required: ["job_id"],
        },
      },
      {
        name: "estimate_job",
        description:
          "Get a cost estimate for a fine-tuning job before submitting it. Returns estimated cost, cost range, current balance, and whether balance is sufficient. Always estimate before creating a job.",
        inputSchema: {
          type: "object" as const,
          properties: {
            base_model: {
              type: "string",
              description:
                "HuggingFace model ID (e.g. 'Qwen/Qwen2.5-Coder-7B-Instruct'). Required unless base_user_model_id is provided.",
            },
            base_user_model_id: {
              type: "string",
              description:
                "ID of a previously trained model. The base model is resolved automatically.",
            },
            num_epochs: { type: "number", description: "Training epochs" },
            max_examples: { type: "number", description: "Maximum examples" },
            repo_size_mb: {
              type: "number",
              description:
                "Approximate repository size in MB (helps refine the estimate)",
            },
            use_case: {
              type: "string",
              description:
                "Agent to use for the estimate (e.g. 'code_repo' for Cody, 'sera_code_repo' for SIERA). Defaults to code_repo.",
            },
          },
        },
      },
      {
        name: "validate_s3",
        description:
          "Validate S3 credentials by testing read/write access to the specified bucket. Use before submitting a job with S3 export.",
        inputSchema: {
          type: "object" as const,
          properties: {
            s3_bucket: { type: "string", description: "S3 bucket name" },
            s3_access_key_id: { type: "string", description: "AWS access key ID" },
            s3_secret_access_key: { type: "string", description: "AWS secret access key" },
            s3_region: { type: "string", description: "AWS region (e.g. us-east-1)" },
          },
          required: ["s3_bucket", "s3_access_key_id", "s3_secret_access_key", "s3_region"],
        },
      },
      {
        name: "list_models",
        description:
          "List your trained and imported models on Tuning Engines.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "show_model",
        description: "Get details of a specific trained model.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: { type: "string", description: "Model ID (UUID)" },
          },
          required: ["model_id"],
        },
      },
      {
        name: "delete_model",
        description: "Delete a trained model from cloud storage.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: { type: "string", description: "Model ID to delete" },
          },
          required: ["model_id"],
        },
      },
      {
        name: "get_balance",
        description:
          "Check your Tuning Engines account balance and recent transactions.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "get_account",
        description: "Get your Tuning Engines account details and settings.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "list_supported_models",
        description:
          "List the supported base HuggingFace models available for fine-tuning on Tuning Engines. Optionally filter by agent to see only compatible models.",
        inputSchema: {
          type: "object" as const,
          properties: {
            agent: {
              type: "string",
              description: "Filter models compatible with this agent (e.g. 'code_repo', 'sera_code_repo'). Omit to see all models.",
            },
          },
        },
      },
      {
        name: "import_model",
        description:
          "Import a model from S3 into Tuning Engines cloud storage so it can be used as a base for future fine-tuning jobs.",
        inputSchema: {
          type: "object" as const,
          properties: {
            name: { type: "string", description: "Name for the imported model" },
            source_s3_url: {
              type: "string",
              description: "S3 URL of the model to import (e.g. s3://bucket/path/to/model)",
            },
            base_model: {
              type: "string",
              description: "HuggingFace model ID that this model was fine-tuned from",
            },
            s3_access_key_id: { type: "string", description: "AWS access key ID" },
            s3_secret_access_key: { type: "string", description: "AWS secret access key" },
            s3_region: { type: "string", description: "AWS region (e.g. us-east-1)" },
          },
          required: ["name", "source_s3_url", "base_model", "s3_access_key_id", "s3_secret_access_key", "s3_region"],
        },
      },
      {
        name: "export_model",
        description:
          "Export a trained model from Tuning Engines cloud storage to your S3 bucket.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: { type: "string", description: "Model ID (UUID) to export" },
            s3_bucket: { type: "string", description: "Destination S3 bucket name" },
            s3_prefix: {
              type: "string",
              description: "Optional S3 key prefix for the exported model",
            },
            s3_access_key_id: { type: "string", description: "AWS access key ID" },
            s3_secret_access_key: { type: "string", description: "AWS secret access key" },
            s3_region: { type: "string", description: "AWS region (e.g. us-east-1)" },
            delete_after: {
              type: "boolean",
              description: "Delete the model from Tuning Engines storage after export (default: false)",
            },
          },
          required: ["model_id", "s3_bucket", "s3_access_key_id", "s3_secret_access_key", "s3_region"],
        },
      },
      {
        name: "model_status",
        description:
          "Check the status of a model import or export operation.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: { type: "string", description: "Model ID (UUID)" },
          },
          required: ["model_id"],
        },
      },
      {
        name: "list_catalog_models",
        description:
          "List available pre-built models and datasets from the Tuning Engines Marketplace. " +
          "These are platform-owned, ready-to-use assets that can be exported to your S3 bucket. " +
          "Returns name, description, base model, size, export price, and category.",
        inputSchema: {
          type: "object" as const,
          properties: {
            category: {
              type: "string",
              description: "Filter by category (e.g. 'code', 'bug-fix', 'general'). Omit to see all.",
            },
          },
        },
      },
      {
        name: "get_catalog_model",
        description:
          "Get detailed information about a specific pre-built model or dataset from the Marketplace including description, pricing, and export options.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: { type: "string", description: "Catalog model ID (UUID)" },
          },
          required: ["model_id"],
        },
      },
      {
        name: "export_catalog_model",
        description:
          "Export a pre-built model or dataset from the Marketplace to your S3 bucket. " +
          "Credits will be charged based on the export price upon successful completion.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: { type: "string", description: "Catalog model ID (UUID) to export" },
            s3_bucket: { type: "string", description: "Destination S3 bucket name" },
            s3_prefix: {
              type: "string",
              description: "Optional S3 key prefix for the exported model",
            },
            s3_access_key_id: { type: "string", description: "AWS access key ID" },
            s3_secret_access_key: { type: "string", description: "AWS secret access key" },
            s3_region: { type: "string", description: "AWS region (e.g. us-east-1)" },
          },
          required: ["model_id", "s3_bucket", "s3_access_key_id", "s3_secret_access_key", "s3_region"],
        },
      },
      {
        name: "catalog_export_status",
        description:
          "Check the status of a Marketplace export operation. Returns status, charge info, and any error messages.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model_id: { type: "string", description: "Catalog model ID (UUID)" },
            export_id: { type: "string", description: "Export operation ID (UUID)" },
          },
          required: ["model_id", "export_id"],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: any;

      switch (name) {
        case "list_jobs":
          result = await getClient().listJobs({
            status: args?.status as string | undefined,
            limit: args?.limit as number | undefined,
          });
          break;

        case "show_job":
          result = await getClient().getJob(args!.job_id as string);
          break;

        case "create_job":
          if (!args?.base_model && !args?.base_user_model_id) {
            return {
              content: [{ type: "text", text: "Error: either base_model or base_user_model_id is required" }],
              isError: true,
            };
          }
          result = await getClient().createJob({
            base_model: args?.base_model as string | undefined,
            base_user_model_id: args?.base_user_model_id as string | undefined,
            output_name: args!.output_name as string,
            repo_url: args?.repo_url as string | undefined,
            branch: args?.branch as string | undefined,
            num_epochs: args?.num_epochs as number | undefined,
            max_examples: args?.max_examples as number | undefined,
            s3_output_bucket: args?.s3_output_bucket as string | undefined,
            s3_access_key_id: args?.s3_access_key_id as string | undefined,
            s3_secret_access_key: args?.s3_secret_access_key as string | undefined,
            s3_region: args?.s3_region as string | undefined,
            agent: args?.agent as string | undefined,
            quality_tier: args?.quality_tier as string | undefined,
          });
          break;

        case "cancel_job":
          result = await getClient().cancelJob(args!.job_id as string);
          break;

        case "job_status":
          result = await getClient().getJobStatus(args!.job_id as string);
          break;

        case "retry_job": {
          // Fetch job details and estimate before retrying so the AI can show cost
          const retryJobId = args!.job_id as string;
          const jobDetails = await getClient().getJob(retryJobId);
          let retryEstimate: any = null;
          try {
            retryEstimate = await getClient().estimateJob({
              base_model: jobDetails.base_model,
              num_epochs: jobDetails.num_epochs,
              max_examples: jobDetails.max_examples,
              use_case: jobDetails.agent,
            });
          } catch (estErr: any) {
            // Estimate failed — continue with retry (server validates balance)
          }
          const retryResult = await getClient().retryJob(
            retryJobId,
            args?.github_token as string | undefined,
          );
          result = {
            ...retryResult,
            retry_estimate: retryEstimate,
          };
          break;
        }

        case "estimate_job":
          if (!args?.base_model && !args?.base_user_model_id) {
            return {
              content: [{ type: "text", text: "Error: either base_model or base_user_model_id is required" }],
              isError: true,
            };
          }
          result = await getClient().estimateJob({
            base_model: args?.base_model as string | undefined,
            base_user_model_id: args?.base_user_model_id as string | undefined,
            num_epochs: args?.num_epochs as number | undefined,
            max_examples: args?.max_examples as number | undefined,
            repo_size_mb: args?.repo_size_mb as number | undefined,
            use_case: args?.use_case as string | undefined,
          });
          break;

        case "validate_s3":
          result = await getClient().validateS3({
            s3_bucket: args!.s3_bucket as string,
            s3_access_key_id: args!.s3_access_key_id as string,
            s3_secret_access_key: args!.s3_secret_access_key as string,
            s3_region: args!.s3_region as string,
          });
          break;

        case "list_models":
          result = await getClient().listUserModels();
          break;

        case "show_model":
          result = await getClient().getUserModel(args!.model_id as string);
          break;

        case "delete_model":
          result = await getClient().deleteUserModel(args!.model_id as string);
          break;

        case "get_balance":
          result = await getClient().getBilling();
          break;

        case "get_account":
          result = await getClient().getAccount();
          break;

        case "list_supported_models":
          result = await getClient().listModels({ agent: args?.agent as string | undefined });
          break;

        case "import_model":
          result = await getClient().importModel({
            name: args!.name as string,
            source_s3_url: args!.source_s3_url as string,
            base_model: args!.base_model as string,
            s3_access_key_id: args!.s3_access_key_id as string,
            s3_secret_access_key: args!.s3_secret_access_key as string,
            s3_region: args!.s3_region as string,
          });
          break;

        case "export_model":
          result = await getClient().exportModel(args!.model_id as string, {
            s3_bucket: args!.s3_bucket as string,
            s3_prefix: args?.s3_prefix as string | undefined,
            s3_access_key_id: args!.s3_access_key_id as string,
            s3_secret_access_key: args!.s3_secret_access_key as string,
            s3_region: args!.s3_region as string,
            delete_after: args?.delete_after as boolean | undefined,
          });
          break;

        case "model_status":
          result = await getClient().getUserModelStatus(args!.model_id as string);
          break;

        case "list_catalog_models":
          result = await getClient().listCatalogModels({
            category: args?.category as string | undefined,
          });
          break;

        case "get_catalog_model":
          result = await getClient().getCatalogModel(args!.model_id as string);
          break;

        case "export_catalog_model":
          result = await getClient().exportCatalogModel(args!.model_id as string, {
            s3_bucket: args!.s3_bucket as string,
            s3_prefix: args?.s3_prefix as string | undefined,
            s3_access_key_id: args!.s3_access_key_id as string,
            s3_secret_access_key: args!.s3_secret_access_key as string,
            s3_region: args!.s3_region as string,
          });
          break;

        case "catalog_export_status":
          result = await getClient().getCatalogExportStatus(
            args!.model_id as string,
            args!.export_id as string
          );
          break;

        default:
          return {
            content: [
              { type: "text", text: `Unknown tool: ${name}` },
            ],
            isError: true,
          };
      }

      return {
        content: [
          { type: "text", text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          { type: "text", text: `Error: ${error.message}` },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
