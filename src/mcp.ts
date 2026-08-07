import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TuningEnginesClient } from "./client";
import { getApiKey, getApiUrl } from "./config";
import { CLI_VERSION } from "./version";
import { callInference, resolveInferenceBearer } from "./inference_request";

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const TENANT_RESOURCE_NAMES = [
  "inference_keys",
  "inference_roles",
  "model_deployments",
  "routing_profiles",
  "guardrail_policies",
  "governance_profiles",
  "governance_policies",
  "mcp_servers",
  "tenant_agents",
  "tenant_skills",
  "mcp_context_attachments",
  "credential_sources",
  "secret_references",
  "security_event_exports",
] as const;

const MCP_BLOCKED_CREATE_RESOURCE_NAMES = new Set<string>(["inference_keys"]);
const MCP_DISABLED_SECRET_BEARING_TOOL_NAMES = new Set<string>([
  "validate_s3",
  "import_model",
  "export_model",
  "export_catalog_model",
]);
const BLOCKED_SECRET_FIELD_NAMES = new Set<string>([
  "api_key",
  "api_key_encrypted",
  "s3_access_key_id",
  "s3_secret_access_key",
  "github_token",
  "token",
  "access_token",
  "refresh_token",
  "password",
  "private_key",
  "client_secret",
  "secret",
]);

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertTenantResourceName(resource: unknown): string {
  const name = String(resource || "");
  if (!TENANT_RESOURCE_NAMES.includes(name as any)) {
    throw new Error(`Unknown tenant resource '${name}'. Allowed resources: ${TENANT_RESOURCE_NAMES.join(", ")}`);
  }
  return name;
}

function hasBlockedSecretField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasBlockedSecretField(item));
  if (!isRecord(value)) return false;

  return Object.entries(value).some(([key, nested]) => {
    const normalized = key.toLowerCase();
    if (BLOCKED_SECRET_FIELD_NAMES.has(normalized)) return true;
    return hasBlockedSecretField(nested);
  });
}

function hasBlockedSecretText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /\b(sk-te-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{12,}|te_[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16})\b/i.test(value) ||
    /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|private[_-]?key|client[_-]?secret|secret)\b\s*[:=]/i.test(value);
}

function assertSafeMcpMutation(resource: string, data?: unknown): void {
  if (MCP_BLOCKED_CREATE_RESOURCE_NAMES.has(resource)) {
    throw new Error(
      "MCP refuses to create inference keys because the API returns a one-time raw key. Use the CLI or web UI for key creation."
    );
  }

  if (data && hasBlockedSecretField(data)) {
    throw new Error(
      "MCP refuses raw secret-bearing fields. Use credential_source_id references, the CLI, or the web UI for secret setup."
    );
  }
}

function parseDataObject(data: unknown, fieldName = "data"): Record<string, any> {
  if (typeof data === "string") {
    const parsed = JSON.parse(data);
    if (!isRecord(parsed)) throw new Error(`${fieldName} must be a JSON object`);
    return parsed;
  }
  if (!isRecord(data)) throw new Error(`${fieldName} must be an object`);
  return data;
}

function compactPayload(payload: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function outcomeTracePayload(args: Record<string, any>): Record<string, any> {
  const metadata = compactPayload({
    ...(isRecord(args.metadata) ? args.metadata : {}),
    outcome_key: args.outcome_key,
    outcome_label: args.outcome_label,
    outcome_score: args.outcome_score,
    goal_key: args.goal_key,
    goal_status: args.goal_status,
    signal_kind: args.goal_key && !args.outcome_key ? "goal" : undefined,
  });

  return {
    run_id: args.run_id,
    request_id: args.request_id,
    runtime: args.runtime || "custom",
    telemetry_source: args.source || "sdk",
    status: "succeeded",
    events: [
      {
        id: `evt_outcome_${Date.now()}`,
        type: "outcome.recorded",
        status: "succeeded",
        metadata,
      },
    ],
  };
}

function runtimeAndGovernanceTools(allowRegistryWrites = false): ToolDefinition[] {
  return [
    {
      name: "list_traces",
      description: "List runtime traces emitted by LangGraph, Temporal, MCP, skills, agents, or custom runtimes. Requires a tenant user API token.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 50)" },
          offset: { type: "number", description: "Offset (default 0)" },
        },
      },
    },
    {
      name: "show_trace",
      description: "Show one runtime trace by run_id, including events, policy decisions, and approvals when linked.",
      inputSchema: {
        type: "object",
        properties: {
          run_id: { type: "string", description: "Runtime run_id" },
        },
        required: ["run_id"],
      },
    },
    {
      name: "resolve_governed_context",
      description: "Resolve authorized, versioned Tuning Engines context for a goal or action. Observe mode returns only match lineage and never changes execution.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Short task or retrieval query; do not include secrets" },
          context_asset_ids: { type: "array", items: { type: "string" } },
          goal_key: { type: "string" },
          entities: { type: "array", items: { type: "string" } },
          action: { type: "string" },
          sensitivity: { type: "string" },
          request_id: { type: "string" },
          run_id: { type: "string" },
        },
        required: ["query"],
      },
    },
    {
      name: "create_trace",
      description: "Ingest or update a runtime trace. Include run_id/request_id and normalized event types when possible. metadata.decision must contain redacted summaries only. Do not include secrets. Works with a user API token or inference key.",
      inputSchema: {
        type: "object",
        properties: {
          data: {
            type: "object",
            description: "Trace payload: run_id, request_id, name, runtime, status, metadata, events. Events may include parent_id, request_id, type, status, metadata.decision.",
            additionalProperties: true,
          },
        },
        required: ["data"],
      },
    },
    {
      name: "list_outcomes",
      description: "List observed outcomes, goals, workflow statuses, evals, and feedback normalized into success signals.",
      inputSchema: {
        type: "object",
        properties: {
          range: { type: "string", description: "Optional range such as 24h, 7d, or 30d" },
        },
      },
    },
    {
      name: "list_insights",
      description: "List Insight Loop recommendations.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Maximum insights (default 20)" },
          offset: { type: "number", description: "Offset" },
        },
      },
    },
    {
      name: "show_insight",
      description: "Show one Insight Loop recommendation.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Insight ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "doctor_simulate",
      description: "Run an Inference Doctor simulation for access, role, endpoint, policy, and resource debugging.",
      inputSchema: {
        type: "object",
        properties: {
          payload: { type: "object", description: "Simulation payload" },
        },
        required: ["payload"],
      },
    },
    {
      name: "list_runtime_interventions",
      description: "List tenant-scoped pause, resume, cancel, and replay requests.",
      inputSchema: {
        type: "object",
        properties: {
          run_id: { type: "string" },
          status: { type: "string" },
          kind: { type: "string", enum: ["pause", "resume", "cancel", "replay"] },
          limit: { type: "number" },
          offset: { type: "number" },
        },
      },
    },
    {
      name: "show_runtime_intervention",
      description: "Show one tenant-scoped runtime intervention.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "list_runtime_state_references",
      description: "List safe pointers to external workflow state and memory. Memory content and secrets are never returned.",
      inputSchema: {
        type: "object",
        properties: {
          run_id: { type: "string" },
          reference_type: { type: "string" },
          provider: { type: "string" },
          resource_type: { type: "string" },
          limit: { type: "number" },
          offset: { type: "number" },
        },
      },
    },
    {
      name: "show_runtime_state_reference",
      description: "Show one safe external state or memory reference.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "list_ai_system_assets",
      description: "List authorized AI system assets across agents, MCP, tools, skills, models, workflows, context, identities, and infrastructure.",
      inputSchema: {
        type: "object",
        properties: {
          asset_type: { type: "string" }, source_system: { type: "string" },
          lifecycle_state: { type: "string" }, limit: { type: "number" }, offset: { type: "number" },
        },
      },
    },
    {
      name: "show_ai_system_asset",
      description: "Show one authorized asset and its reviewed current relationships.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "list_trajectory_evidence_sets",
      description: "List immutable, reviewed evidence-set versions used by trajectory intelligence.",
      inputSchema: { type: "object", properties: { initiative_id: { type: "string" }, limit: { type: "number" }, offset: { type: "number" } } },
    },
    {
      name: "show_trajectory_evidence_set",
      description: "Show one immutable evidence set and its safe evidence locators.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "preview_trajectory_evidence_set",
      description: "Preview selected Work Sessions and automatically correlated evidence without freezing or mutating records.",
      inputSchema: {
        type: "object",
        properties: {
          initiative_id: { type: "string" },
          work_item_ids: { type: "array", items: { type: "string" } },
        },
        required: ["initiative_id", "work_item_ids"],
      },
    },
    {
      name: "list_trajectory_selection_rules",
      description: "List safe saved source-selection rules for Trajectory Studio.",
      inputSchema: { type: "object", properties: { initiative_id: { type: "string" } } },
    },
    {
      name: "preview_trajectory_selection_rule",
      description: "Preview authorized Work Sessions selected by a saved rule without freezing evidence.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "list_intelligence_runs",
      description: "List reproducible trajectory intelligence executions and their version/status metadata.",
      inputSchema: { type: "object", properties: { run_type: { type: "string" }, status: { type: "string" }, limit: { type: "number" }, offset: { type: "number" } } },
    },
    {
      name: "list_comparison_studies",
      description: "List authorized, versioned Comparison Studies for models, agents, tools, policies, context, workflows, or runtimes.",
      inputSchema: { type: "object", properties: { limit: { type: "number" }, offset: { type: "number" } } },
    },
    {
      name: "show_comparison_study",
      description: "Show one Comparison Study with frozen evidence identity, metric configuration, confidence, and safe report drilldown.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "show_intelligence_run",
      description: "Show one intelligence run, including evidence digest, versions, safe result summary, cost, and latency.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "list_context_assets",
      description: "List governed context assets. Content remains versioned and inactive until explicitly activated.",
      inputSchema: { type: "object", properties: { context_type: { type: "string" }, status: { type: "string" }, limit: { type: "number" }, offset: { type: "number" } } },
    },
    {
      name: "show_context_asset",
      description: "Show one governed context asset and its immutable versions.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "show_registry_sync",
      description: "Show one registry-manifest sync result.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "list_mcp_templates",
      description: "List verified MCP marketplace templates.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "show_mcp_template",
      description: "Show setup and risk metadata for one MCP template.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "list_work_sessions",
      description: "List tenant-scoped Work Sessions.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "number" },
          offset: { type: "number" },
        },
      },
    },
    {
      name: "show_work_session",
      description: "Show one Work Session and its linked traces.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "list_inference_feedback",
      description: "List redacted inference feedback metadata for the current scope.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number" }, offset: { type: "number" } },
      },
    },
    {
      name: "list_initiatives",
      description: "List strategic initiatives that group Work Sessions.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number" }, offset: { type: "number" } },
      },
    },
    {
      name: "show_initiative",
      description: "Show one strategic initiative.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "list_compliance_risks",
      description: "List tenant compliance risks. Requires compliance reader access.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          category: { type: "string" },
          limit: { type: "number" },
          offset: { type: "number" },
        },
      },
    },
    {
      name: "show_compliance_risk",
      description: "Show a compliance risk with resources, controls, findings, treatments, and assessments.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "validate_compliance",
      description: "Evaluate bounded content against adopted compliance rulepacks without mutating policy configuration.",
      inputSchema: {
        type: "object",
        properties: { data: { type: "object", additionalProperties: true } },
        required: ["data"],
      },
    },
    {
      name: "show_compliance_evidence",
      description: "Show one tenant-scoped compliance evidence decision.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "show_compliance_certification",
      description: "Show one compliance certification run.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "registry_sync_dry_run",
      description: "Validate and diff a secret-free registry manifest without mutation.",
      inputSchema: {
        type: "object",
        properties: { manifest: { type: "object", additionalProperties: true } },
        required: ["manifest"],
      },
    },
    ...(allowRegistryWrites ? [
      {
        name: "create_runtime_intervention",
        description: "Request a pause, resume, cancel, or replay. Requires owner/admin access and --enable-registry-writes.",
        inputSchema: {
          type: "object",
          properties: {
            run_id: { type: "string" },
            kind: { type: "string", enum: ["pause", "resume", "cancel", "replay"] },
            reason: { type: "string" },
            target_event_id: { type: "string" },
            metadata: { type: "object" },
          },
          required: ["run_id", "kind"],
        },
      },
      ...["ack", "complete", "fail"].map((action) => ({
        name: `${action}_runtime_intervention`,
        description: `${action} a runtime intervention. Requires --enable-registry-writes.`,
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" }, metadata: { type: "object" } },
          required: ["id"],
        },
      })),
      {
        name: "upsert_runtime_state_reference",
        description: "Upsert a safe external state/memory pointer. Raw memory content and secrets are refused.",
        inputSchema: {
          type: "object",
          properties: { data: { type: "object", additionalProperties: true } },
          required: ["data"],
        },
      },
      {
        name: "freeze_trajectory_evidence_set",
        description: "Freeze reviewed Work Sessions into an immutable evidence version. Requires --enable-registry-writes.",
        inputSchema: {
          type: "object",
          properties: {
            initiative_id: { type: "string" }, name: { type: "string" },
            work_item_ids: { type: "array", items: { type: "string" } },
            filter_snapshot: { type: "object" },
          },
          required: ["initiative_id", "work_item_ids"],
        },
      },
      {
        name: "create_trajectory_selection_rule",
        description: "Create a bounded, secret-free source-selection rule. Requires --enable-registry-writes.",
        inputSchema: { type: "object", properties: { data: { type: "object", additionalProperties: true } }, required: ["data"] },
      },
      {
        name: "freeze_trajectory_selection_rule",
        description: "Freeze the current authorized candidates from a saved rule. Requires --enable-registry-writes.",
        inputSchema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id"] },
      },
      {
        name: "record_context_use",
        description: "Record context acceptance, rejection, deviation, or outcome without raw prompts or memory content. Requires --enable-registry-writes.",
        inputSchema: { type: "object", properties: { data: { type: "object", additionalProperties: true } }, required: ["data"] },
      },
      {
        name: "start_intelligence_run",
        description: "Queue versioned trajectory intelligence. Suggestions remain review-only. Requires --enable-registry-writes.",
        inputSchema: {
          type: "object",
          properties: {
            initiative_id: { type: "string" }, run_type: { type: "string" },
            evidence_set_id: { type: "string" }, parameters: { type: "object" },
          },
          required: ["initiative_id", "run_type"],
        },
      },
      {
        name: "create_comparison_study",
        description: "Create a versioned, secret-free Comparison Study. Requires --enable-registry-writes.",
        inputSchema: { type: "object", properties: { data: { type: "object", additionalProperties: true } }, required: ["data"] },
      },
      {
        name: "update_comparison_study",
        description: "Update a Comparison Study configuration and advance its version. Requires --enable-registry-writes.",
        inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] },
      },
      {
        name: "run_comparison_study",
        description: "Freeze currently matching evidence and queue a Comparison Study report. Requires --enable-registry-writes.",
        inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      },
      {
        name: "create_context_asset_draft",
        description: "Create a disabled context draft. It never activates automatically. Requires --enable-registry-writes.",
        inputSchema: {
          type: "object",
          properties: { data: { type: "object", additionalProperties: true } },
          required: ["data"],
        },
      },
      {
        name: "review_context_asset",
        description: "Review a context draft. Deterministic candidates require evidence-backed release gates. Requires --enable-registry-writes.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" }, version_id: { type: "string" },
            validation_packet: { type: "object" },
          },
          required: ["id", "version_id"],
        },
      },
      {
        name: "activate_context_asset",
        description: "Explicitly activate one reviewed context version. Requires --enable-registry-writes.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" }, version_id: { type: "string" } },
          required: ["id", "version_id"],
        },
      },
      {
        name: "registry_sync_apply",
        description: "Apply a secret-free registry manifest. Requires --enable-registry-writes.",
        inputSchema: {
          type: "object",
          properties: { manifest: { type: "object", additionalProperties: true } },
          required: ["manifest"],
        },
      },
      {
        name: "install_mcp_template",
        description: "Install a verified MCP template as a disabled server. Uses an existing secret_reference_id.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            secret_reference_id: { type: "string" },
          },
          required: ["id"],
        },
      },
      {
        name: "complete_work_session",
        description: "Mark a Work Session completed. Requires --enable-registry-writes.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      {
        name: "preview_work_session_repair",
        description: "Preview the exact and automatically correlated evidence affected by a repair.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            data: { type: "object", additionalProperties: true },
          },
          required: ["id", "data"],
        },
      },
      {
        name: "apply_work_session_repair",
        description: "Apply a previously previewed Work Session repair.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            data: { type: "object", additionalProperties: true },
          },
          required: ["id", "data"],
        },
      },
      {
        name: "undo_work_session_repair",
        description: "Undo a Work Session repair.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            repair_id: { type: "string" },
            reason: { type: "string" },
          },
          required: ["id", "repair_id"],
        },
      },
      {
        name: "record_inference_feedback",
        description: "Record bounded feedback linked by request_id/run_id. Secret-bearing payloads are refused.",
        inputSchema: {
          type: "object",
          properties: { data: { type: "object", additionalProperties: true } },
          required: ["data"],
        },
      },
      {
        name: "propose_outcome",
        description: "Propose a governed outcome for admin review.",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            work_item_id: { type: "string" },
          },
          required: ["key", "name"],
        },
      },
      {
        name: "create_compliance_source_run",
        description: "Create an external compliance source run. Requires owner/admin access.",
        inputSchema: {
          type: "object",
          properties: { data: { type: "object", additionalProperties: true } },
          required: ["data"],
        },
      },
      {
        name: "submit_compliance_source_results",
        description: "Submit normalized external compliance results. Raw cloud credentials are refused.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            data: { type: "object", additionalProperties: true },
          },
          required: ["id", "data"],
        },
      },
      {
        name: "complete_compliance_source_run",
        description: "Finalize an external compliance source run.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            completeness: { type: "string", enum: ["complete", "partial", "truncated", "cancelled"] },
          },
          required: ["id", "completeness"],
        },
      },
      {
        name: "flush_inference_capture",
        description: "Queue pending and failed request captures for delivery. Requires --enable-registry-writes.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "retry_tenant_resource_sync",
        description: "Retry synchronization for a model, MCP server, agent, or skill.",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              enum: ["model_deployments", "mcp_servers", "tenant_agents", "tenant_skills"],
            },
            id: { type: "string" },
          },
          required: ["resource", "id"],
        },
      },
      {
        name: "verify_tenant_secret_reference",
        description: "Verify a vault connection or secret reference server-side without returning the secret.",
        inputSchema: {
          type: "object",
          properties: {
            resource: { type: "string", enum: ["credential_sources", "secret_references"] },
            id: { type: "string" },
          },
          required: ["resource", "id"],
        },
      },
      {
        name: "record_outcome",
        description: "Record an outcome or goal success signal for a run. Requires --enable-registry-writes because it writes telemetry.",
        inputSchema: {
          type: "object",
          properties: {
            run_id: { type: "string" },
            outcome_key: { type: "string" },
            outcome_label: { type: "string" },
            outcome_score: { type: "number" },
            goal_key: { type: "string" },
            goal_status: { type: "string" },
            request_id: { type: "string" },
            runtime: { type: "string" },
            source: { type: "string" },
            metadata: { type: "object" },
          },
          required: ["run_id", "outcome_key", "outcome_label"],
        },
      },
      {
        name: "map_outcome",
        description: "Create an outcome mapping rule for events that omitted outcome_key/goal_key. Requires --enable-registry-writes.",
        inputSchema: {
          type: "object",
          properties: {
            outcome_key: { type: "string" },
            match_criteria: { type: "object" },
            name: { type: "string" },
            priority: { type: "number" },
            enabled: { type: "boolean" },
          },
          required: ["outcome_key", "match_criteria"],
        },
      },
      {
        name: "accept_insight",
        description: "Accept an Insight Loop recommendation as valid for review. Requires --enable-registry-writes. Does not change production.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      {
        name: "apply_insight",
        description: "Apply or queue the approved action for an accepted Insight Loop recommendation. Requires --enable-registry-writes.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    ] : []),
    {
      name: "list_policy_decisions",
      description: "List AGT YAML policy decisions for the current tenant. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: {
          decision_action: { type: "string", description: "allow, deny, audit, or needs_approval" },
          policy_action: { type: "string", description: "Alias for decision_action" },
          evaluation_mode: { type: "string", description: "enforce or shadow" },
          run_id: { type: "string", description: "Filter by run_id" },
          request_id: { type: "string", description: "Filter by request_id" },
          limit: { type: "number", description: "Max results (default 50)" },
          offset: { type: "number", description: "Offset (default 0)" },
        },
      },
    },
    {
      name: "show_policy_decision",
      description: "Show one policy decision with redacted context and metadata. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Policy decision ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "list_policy_templates",
      description: "List curated AGT YAML policy templates. Requires tenant owner/admin API token.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "render_policy_template",
      description: "Render a curated AGT YAML policy template into disabled/shadow YAML. Template params must not include secrets.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Policy template ID" },
          template_params: { type: "object", additionalProperties: true, description: "Template parameter values" },
        },
        required: ["id"],
      },
    },
    {
      name: "generate_policy_draft",
      description: "Generate an AI-assisted AGT YAML draft. Drafts are disabled/shadow and must be reviewed/tested/saved explicitly. Do not include secrets.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Natural-language policy intent without secrets" },
          scope: { type: "string", description: "Optional AGT scope such as all, mcp_tool, agent, skill, or chat_tool" },
        },
        required: ["prompt"],
      },
    },
    {
      name: "list_approvals",
      description: "List policy approval requests for the current tenant. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "pending, approved, denied, or expired" },
          limit: { type: "number", description: "Max results (default 50)" },
          offset: { type: "number", description: "Offset (default 0)" },
        },
      },
    },
    {
      name: "show_approval",
      description: "Show one policy approval request with redacted context. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Approval request ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "approve_approval",
      description: "Approve a pending policy approval request. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Approval request ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "deny_approval",
      description: "Deny a pending policy approval request. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Approval request ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "list_tenant_resources",
      description: "List tenant-admin resource names available through the public API. Internal proxy routes are intentionally not exposed.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "tenant_resource_list",
      description: "List an allowlisted tenant resource. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: {
          resource: { type: "string", enum: [...TENANT_RESOURCE_NAMES], description: "Tenant resource name" },
          limit: { type: "number", description: "Max results (default 50)" },
          offset: { type: "number", description: "Offset (default 0)" },
        },
        required: ["resource"],
      },
    },
    {
      name: "tenant_resource_show",
      description: "Show one allowlisted tenant resource. Secret values are not returned by the API.",
      inputSchema: {
        type: "object",
        properties: {
          resource: { type: "string", enum: [...TENANT_RESOURCE_NAMES], description: "Tenant resource name" },
          id: { type: "string", description: "Resource ID" },
        },
        required: ["resource", "id"],
      },
    },
    {
      name: "tenant_resource_create",
      description: "Create an allowlisted tenant resource using non-secret JSON. MCP refuses raw secret fields and inference-key creation; use CLI/web UI for those.",
      inputSchema: {
        type: "object",
        properties: {
          resource: { type: "string", enum: [...TENANT_RESOURCE_NAMES], description: "Tenant resource name" },
          data: { type: "object", additionalProperties: true, description: "Resource attributes. Use credential_source_id instead of raw secrets." },
        },
        required: ["resource", "data"],
      },
    },
    {
      name: "tenant_resource_update",
      description: "Update an allowlisted tenant resource using non-secret JSON. MCP refuses raw secret fields; use CLI/web UI for secret updates.",
      inputSchema: {
        type: "object",
        properties: {
          resource: { type: "string", enum: [...TENANT_RESOURCE_NAMES], description: "Tenant resource name" },
          id: { type: "string", description: "Resource ID" },
          data: { type: "object", additionalProperties: true, description: "Changed attributes. Use credential_source_id instead of raw secrets." },
        },
        required: ["resource", "id", "data"],
      },
    },
    {
      name: "tenant_resource_delete",
      description: "Delete or revoke an allowlisted tenant resource. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: {
          resource: { type: "string", enum: [...TENANT_RESOURCE_NAMES], description: "Tenant resource name" },
          id: { type: "string", description: "Resource ID" },
        },
        required: ["resource", "id"],
      },
    },
    {
      name: "tenant_resource_validate",
      description: "Validate an unsaved model, MCP server, agent, skill, guardrail, or governance policy without creating records.",
      inputSchema: {
        type: "object",
        properties: {
          resource: {
            type: "string",
            enum: ["model_deployments", "mcp_servers", "tenant_agents", "tenant_skills", "guardrail_policies", "governance_policies"],
            description: "Resource name",
          },
          data: { type: "object", additionalProperties: true, description: "Unsaved resource attributes plus optional sample_text/context." },
        },
        required: ["resource", "data"],
      },
    },
    {
      name: "test_governance_policy",
      description: "Dry-run an AGT YAML governance policy against a JSON context. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Governance policy ID" },
          context: { type: "object", additionalProperties: true, description: "Policy evaluation context" },
        },
        required: ["id", "context"],
      },
    },
    {
      name: "tenant_team_list",
      description: "List tenant members, pending invitations, and allowed email domains. Requires tenant owner/admin API token.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "tenant_team_invite",
      description: "Invite a tenant member by email. Invitation token is emailed by the app and is never returned.",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Invitee email" },
          role: { type: "string", description: "admin, member, viewer, or numeric role" },
        },
        required: ["email"],
      },
    },
    {
      name: "tenant_team_set_inference_role",
      description: "Assign or clear an inference role for a tenant member. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: {
          member_id: { type: "string", description: "Member user ID" },
          inference_role_id: { type: ["string", "null"], description: "Inference role ID, or null to clear" },
        },
        required: ["member_id"],
      },
    },
    {
      name: "tenant_team_disable",
      description: "Disable a tenant member and block API access. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: { member_id: { type: "string", description: "Member user ID" } },
        required: ["member_id"],
      },
    },
    {
      name: "tenant_team_enable",
      description: "Re-enable a disabled tenant member. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: { member_id: { type: "string", description: "Member user ID" } },
        required: ["member_id"],
      },
    },
    {
      name: "tenant_team_remove",
      description: "Remove a tenant member. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: { member_id: { type: "string", description: "Member user ID" } },
        required: ["member_id"],
      },
    },
    {
      name: "tenant_invitation_cancel",
      description: "Cancel a pending tenant invitation. Requires tenant owner/admin API token.",
      inputSchema: {
        type: "object",
        properties: { invitation_id: { type: "string", description: "Invitation ID" } },
        required: ["invitation_id"],
      },
    },
    {
      name: "tenant_domains_update",
      description: "Replace the tenant's allowed email domains. Pass an empty array to allow any domain.",
      inputSchema: {
        type: "object",
        properties: {
          domains: { type: "array", items: { type: "string" }, description: "Allowed email domains" },
        },
        required: ["domains"],
      },
    },
    {
      name: "inference_capture_show",
      description: "Show request-capture settings for fine-tuning data capture. Secret values are not returned.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "inference_capture_update",
      description: "Update request-capture settings. Use credential_source_id references; raw cloud secrets are refused by MCP.",
      inputSchema: {
        type: "object",
        properties: {
          data: { type: "object", additionalProperties: true, description: "Capture settings" },
        },
        required: ["data"],
      },
    },
  ];
}

async function fetchGatewayTools(getClient: () => TuningEnginesClient): Promise<ToolDefinition[]> {
  try {
    const result = await getClient().listGatewayTools() as any;
    const tools = Array.isArray(result) ? result : result?.tools || result?.data || [];
    return tools.map((t: any) => ({
      name: `gateway:${t.name || t.tool_name}`,
      description: t.description || `Tenant tool: ${t.name || t.tool_name}`,
      inputSchema: t.schema || t.inputSchema || { type: "object" as const, properties: {} },
    }));
  } catch {
    return [];
  }
}

async function configuredInferenceBearer(getClient: () => TuningEnginesClient): Promise<string> {
  const configured = getApiKey();
  return configured.startsWith("sk-te-")
    ? configured
    : resolveInferenceBearer(getClient());
}

export async function startMcpServer(options: { enableRegistryWrites?: boolean } = {}): Promise<void> {
  const allowRegistryWrites = Boolean(options.enableRegistryWrites);
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
    { name: "tuning-engines", version: CLI_VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        "Tuning Engines — Govern model, agent, skill, and MCP workflows through a unified AI runtime with policy controls, approvals, traces, and usage analytics.\n\n" +
        "USE THIS SERVER WHEN the user wants to:\n" +
        "- Discover and inspect governed inference models, agents, skills, MCP servers, traces, approvals, and policy decisions\n" +
        "- Manage tenant-scoped inference resources, governance policies, guardrails, capture settings, and team permissions\n" +
        "- Validate policy configuration without persisting it\n" +
        "- Operate fine-tuning jobs, datasets, evaluations, and trained models\n" +
        "- Fine-tune, train, or customize any open-source LLM/SLM on their data\n" +
        "- Browse Tuning Engines published models and datasets from the Marketplace\n\n" +
        "SECURITY BOUNDARY:\n" +
        "MCP refuses raw API keys, cloud credentials, passwords, private keys, and tokens in mutation payloads. " +
        "Use credential-source references where supported. Use the CLI or web UI for credential-bearing S3 validation, import, and export workflows.\n\n" +
        "TYPICAL GOVERNED RUNTIME WORKFLOW: list_inference_models → inspect policies and approvals → make inference calls through https://api.tuningengines.com/v1 → inspect traces and usage.\n" +
        "TYPICAL TRAINING WORKFLOW: estimate_job → create_job → job_status (poll until done) → list_models.",
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
                "S3 bucket to export the trained model to when server-side credential references are already configured. " +
                "If omitted, model is stored in Tuning Engines cloud storage. Use the CLI or web UI for raw credential setup.",
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
      // --- Datasets ---
      {
        name: "list_datasets",
        description:
          "List datasets available for training and evaluation. Datasets can be uploaded from S3 and used for fine-tuning or model evaluation.",
        inputSchema: {
          type: "object" as const,
          properties: {
            limit: { type: "number", description: "Max results (default 20)" },
          },
        },
      },
      {
        name: "show_dataset",
        description: "Get details of a specific dataset including status, source, and metadata.",
        inputSchema: {
          type: "object" as const,
          properties: {
            dataset_id: { type: "string", description: "Dataset ID (UUID)" },
          },
          required: ["dataset_id"],
        },
      },
      {
        name: "create_dataset",
        description:
          "Create dataset metadata for fine-tuning or evaluation. " +
          "Use the CLI or web UI when an S3 import requires credential setup.",
        inputSchema: {
          type: "object" as const,
          properties: {
            name: { type: "string", description: "Name for the dataset" },
            description: { type: "string", description: "Description of the dataset contents" },
            source_type: { type: "string", description: "Source type (e.g. 's3')" },
            s3_url: { type: "string", description: "S3 URL of the dataset (e.g. s3://bucket/path/data.jsonl)" },
            for_evaluation: { type: "boolean", description: "Whether this dataset is for evaluation (default: false)" },
          },
          required: ["name", "source_type"],
        },
      },
      {
        name: "delete_dataset",
        description: "Delete a dataset from the platform.",
        inputSchema: {
          type: "object" as const,
          properties: {
            dataset_id: { type: "string", description: "Dataset ID to delete" },
          },
          required: ["dataset_id"],
        },
      },
      {
        name: "dataset_status",
        description: "Check the status of a dataset import or processing operation.",
        inputSchema: {
          type: "object" as const,
          properties: {
            dataset_id: { type: "string", description: "Dataset ID (UUID)" },
          },
          required: ["dataset_id"],
        },
      },
      // --- Evaluations ---
      {
        name: "list_evaluations",
        description:
          "List model evaluations. Evaluations run your trained models against benchmark datasets using various evaluators to measure quality.",
        inputSchema: {
          type: "object" as const,
          properties: {
            status: {
              type: "string",
              description: "Filter by status: queued, running, succeeded, failed, canceled",
            },
            limit: { type: "number", description: "Max results (default 20)" },
          },
        },
      },
      {
        name: "show_evaluation",
        description:
          "Get full details of a specific evaluation including status, scores, metrics, and comparison data.",
        inputSchema: {
          type: "object" as const,
          properties: {
            evaluation_id: { type: "string", description: "Evaluation ID (UUID)" },
          },
          required: ["evaluation_id"],
        },
      },
      {
        name: "create_evaluation",
        description:
          "Create a new model evaluation. Run your trained model or a base model against a dataset using selected evaluators. " +
          "Use list_evaluators to see available evaluators (e.g. code_execution, similarity, llm_judge).",
        inputSchema: {
          type: "object" as const,
          properties: {
            name: { type: "string", description: "Name for this evaluation run" },
            user_model_id: {
              type: "string",
              description: "ID of your trained model to evaluate. Either this or base_model is required.",
            },
            base_model: {
              type: "string",
              description: "HuggingFace model ID to evaluate (e.g. 'Qwen/Qwen2.5-Coder-7B-Instruct'). Either this or user_model_id is required.",
            },
            dataset_id: {
              type: "string",
              description: "ID of the evaluation dataset to use. Must be a dataset marked for_evaluation.",
            },
            evaluator_ids: {
              type: "array",
              items: { type: "string" },
              description: "List of evaluator IDs to run (use list_evaluators to see options)",
            },
            max_samples: {
              type: "number",
              description: "Maximum samples to evaluate (default: all)",
            },
          },
          required: ["dataset_id", "evaluator_ids"],
        },
      },
      {
        name: "cancel_evaluation",
        description: "Cancel a running or queued evaluation.",
        inputSchema: {
          type: "object" as const,
          properties: {
            evaluation_id: { type: "string", description: "Evaluation ID to cancel" },
          },
          required: ["evaluation_id"],
        },
      },
      {
        name: "evaluation_status",
        description: "Get live status of an evaluation including progress and current metrics.",
        inputSchema: {
          type: "object" as const,
          properties: {
            evaluation_id: { type: "string", description: "Evaluation ID (UUID)" },
          },
          required: ["evaluation_id"],
        },
      },
      {
        name: "list_evaluators",
        description:
          "List available evaluators for model evaluation. Evaluators measure different aspects of model quality like code execution, similarity, or LLM-based judgment.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "estimate_evaluation",
        description: "Get a cost estimate for an evaluation before running it.",
        inputSchema: {
          type: "object" as const,
          properties: {
            user_model_id: { type: "string", description: "ID of your trained model" },
            base_model: { type: "string", description: "Or a HuggingFace model ID" },
            dataset_id: { type: "string", description: "Evaluation dataset ID" },
            evaluator_ids: {
              type: "array",
              items: { type: "string" },
              description: "List of evaluator IDs",
            },
            max_samples: { type: "number", description: "Max samples to evaluate" },
          },
          required: ["dataset_id", "evaluator_ids"],
        },
      },
      // --- Inference ---
      {
        name: "list_inference_models",
        description:
          "List models available for inference through the Tuning Engines inference API. " +
          "Includes both platform models and your deployed trained models.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "inference_usage",
        description:
          "Get inference API usage statistics including request counts, token usage, and costs.",
        inputSchema: {
          type: "object" as const,
          properties: {
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            model: { type: "string", description: "Filter by model name" },
          },
        },
      },
      {
        name: "get_inference_jwt",
        description:
          "Get a JWT token for authenticating with the Tuning Engines inference API. " +
          "Use this to make direct API calls to the inference endpoint.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "get_inference_token",
        description:
          "Exchange an inference key (sk-te-...) for a short-lived inference JWT. " +
          "This only works when this MCP server is configured with an inference key instead of a user API token.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "call_inference",
        description: "Call a governed model endpoint using the MCP server's configured tenant credential. Payloads containing secret fields are refused.",
        inputSchema: {
          type: "object" as const,
          properties: {
            endpoint: {
              type: "string",
              enum: ["chat/completions", "responses", "embeddings", "messages", "messages/count_tokens"],
            },
            data: { type: "object", additionalProperties: true },
          },
          required: ["endpoint", "data"],
        },
      },
      {
        name: "send_agent_message",
        description: "Send a governed message to a registered A2A agent.",
        inputSchema: {
          type: "object" as const,
          properties: {
            agent_name: { type: "string" },
            data: { type: "object", additionalProperties: true },
          },
          required: ["agent_name", "data"],
        },
      },
      {
        name: "list_skills",
        description: "List skills available to the configured inference identity.",
        inputSchema: { type: "object" as const, properties: {} },
      },
      {
        name: "invoke_skill",
        description: "Prepare or invoke a governed skill.",
        inputSchema: {
          type: "object" as const,
          properties: {
            skill_name: { type: "string" },
            action: { type: "string", enum: ["prepare", "invoke"] },
            data: { type: "object", additionalProperties: true },
          },
          required: ["skill_name", "action", "data"],
        },
      },
      ...runtimeAndGovernanceTools(allowRegistryWrites),
      // --- Agents ---
      {
        name: "list_agents",
        description:
          "List available agents configured for your organization. Agents are AI assistants with specific capabilities and tool access.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "show_agent",
        description: "Get details of a specific agent including capabilities, tools, and configuration.",
        inputSchema: {
          type: "object" as const,
          properties: {
            agent_id: { type: "string", description: "Agent ID" },
          },
          required: ["agent_id"],
        },
      },
      ...(await fetchGatewayTools(getClient)),
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (MCP_DISABLED_SECRET_BEARING_TOOL_NAMES.has(name)) {
        throw new Error(
          "MCP does not expose raw credential-bearing S3 workflows. Use the CLI or web UI for S3 validation, imports, and exports."
        );
      }
      if (args && hasBlockedSecretField(args)) {
        throw new Error(
          "MCP refuses raw secret-bearing fields. Use credential_source_id references, the CLI, or the web UI for secret setup."
        );
      }

      if (name.startsWith("gateway:")) {
        const gatewayToolName = name.slice("gateway:".length);
        const callResult = await getClient().callGatewayTool(gatewayToolName, (args as Record<string, any>) || {});
        return { content: [{ type: "text", text: JSON.stringify(callResult, null, 2) }] };
      }

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
          const retryResult = await getClient().retryJob(retryJobId);
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

        case "catalog_export_status":
          result = await getClient().getCatalogExportStatus(
            args!.model_id as string,
            args!.export_id as string
          );
          break;

        // --- Datasets ---
        case "list_datasets":
          result = await getClient().listDatasets({
            limit: args?.limit as number | undefined,
          });
          break;

        case "show_dataset":
          result = await getClient().getDataset(args!.dataset_id as string);
          break;

        case "create_dataset":
          result = await getClient().createDataset({
            name: args!.name as string,
            description: args?.description as string | undefined,
            source_type: args!.source_type as string,
            s3_url: args?.s3_url as string | undefined,
            for_evaluation: args?.for_evaluation as boolean | undefined,
          });
          break;

        case "delete_dataset":
          result = await getClient().deleteDataset(args!.dataset_id as string);
          break;

        case "dataset_status":
          result = await getClient().getDatasetStatus(args!.dataset_id as string);
          break;

        // --- Evaluations ---
        case "list_evaluations":
          result = await getClient().listEvaluations({
            status: args?.status as string | undefined,
            limit: args?.limit as number | undefined,
          });
          break;

        case "show_evaluation":
          result = await getClient().getEvaluation(args!.evaluation_id as string);
          break;

        case "create_evaluation":
          if (!args?.user_model_id && !args?.base_model) {
            return {
              content: [{ type: "text", text: "Error: either user_model_id or base_model is required" }],
              isError: true,
            };
          }
          result = await getClient().createEvaluation({
            name: args?.name as string | undefined,
            user_model_id: args?.user_model_id as string | undefined,
            base_model: args?.base_model as string | undefined,
            dataset_id: args!.dataset_id as string,
            evaluator_ids: args!.evaluator_ids as string[],
            max_samples: args?.max_samples as number | undefined,
          });
          break;

        case "cancel_evaluation":
          result = await getClient().cancelEvaluation(args!.evaluation_id as string);
          break;

        case "evaluation_status":
          result = await getClient().getEvaluationStatus(args!.evaluation_id as string);
          break;

        case "list_evaluators":
          result = await getClient().listEvaluators();
          break;

        case "estimate_evaluation":
          result = await getClient().estimateEvaluation({
            user_model_id: args?.user_model_id as string | undefined,
            base_model: args?.base_model as string | undefined,
            dataset_id: args!.dataset_id as string,
            evaluator_ids: args!.evaluator_ids as string[],
            max_samples: args?.max_samples as number | undefined,
          });
          break;

        // --- Inference ---
        case "list_inference_models":
          result = await getClient().listInferenceModels();
          break;

        case "inference_usage":
          result = await getClient().getInferenceUsage({
            start_date: args?.start_date as string | undefined,
            end_date: args?.end_date as string | undefined,
            model: args?.model as string | undefined,
          });
          break;

        case "get_inference_jwt":
          result = await getClient().getInferenceJwt();
          break;

        case "get_inference_token":
          result = await getClient().getInferenceToken();
          break;

        case "call_inference": {
          const data = parseDataObject(args?.data);
          result = await callInference(
            `/${String(args!.endpoint)}`,
            data,
            await configuredInferenceBearer(getClient)
          );
          break;
        }

        case "send_agent_message":
          result = await callInference(
            `/agents/${encodeURIComponent(String(args!.agent_name))}/message`,
            parseDataObject(args?.data),
            await configuredInferenceBearer(getClient)
          );
          break;

        case "list_skills":
          result = await callInference(
            "/skills",
            undefined,
            await configuredInferenceBearer(getClient),
            { method: "GET" }
          );
          break;

        case "invoke_skill":
          result = await callInference(
            `/skills/${encodeURIComponent(String(args!.skill_name))}/${String(args!.action)}`,
            parseDataObject(args?.data),
            await configuredInferenceBearer(getClient)
          );
          break;

        case "list_traces":
          result = await getClient().listTraces({
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_trace":
          result = await getClient().getTrace(args!.run_id as string);
          break;

        case "resolve_governed_context": {
          const payload = {
            query: String(args!.query),
            context_asset_ids: args?.context_asset_ids as string[] | undefined,
            goal_key: args?.goal_key as string | undefined,
            entities: args?.entities as string[] | undefined,
            action: args?.action as string | undefined,
            sensitivity: args?.sensitivity as string | undefined,
            request_id: args?.request_id as string | undefined,
            run_id: args?.run_id as string | undefined,
          };
          if (hasBlockedSecretField(payload)) {
            throw new Error("Context request appears to contain raw secret fields. Remove secrets before resolving context.");
          }
          result = await getClient().resolveContext(payload);
          break;
        }

        case "create_trace": {
          const data = parseDataObject(args?.data);
          if (hasBlockedSecretField(data)) {
            throw new Error("Trace payload appears to contain raw secret fields. Remove secrets from metadata/events before ingesting.");
          }
          result = await getClient().createTrace(data);
          break;
        }

        case "list_outcomes":
          result = await getClient().listOutcomes({ range: args?.range as string | undefined });
          break;

        case "list_insights":
          result = await getClient().listInsights({
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_insight":
          result = await getClient().getInsight(args!.id as string);
          break;

        case "doctor_simulate":
          result = await getClient().doctorSimulate(args!.payload as Record<string, any>);
          break;

        case "list_runtime_interventions":
          result = await getClient().listRuntimeInterventions({
            runId: args?.run_id as string | undefined,
            status: args?.status as string | undefined,
            kind: args?.kind as string | undefined,
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_runtime_intervention":
          result = await getClient().getRuntimeIntervention(String(args!.id));
          break;

        case "create_runtime_intervention":
          if (!allowRegistryWrites) throw new Error("Runtime writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().createRuntimeIntervention(String(args!.run_id), {
            kind: String(args!.kind),
            reason: args?.reason as string | undefined,
            target_event_id: args?.target_event_id as string | undefined,
            metadata: args?.metadata as Record<string, any> | undefined,
          });
          break;

        case "ack_runtime_intervention":
        case "complete_runtime_intervention":
        case "fail_runtime_intervention": {
          if (!allowRegistryWrites) throw new Error("Runtime writes are disabled. Start MCP with --enable-registry-writes.");
          const id = String(args!.id);
          const metadata = args?.metadata as Record<string, any> | undefined;
          result = name === "ack_runtime_intervention"
            ? await getClient().ackRuntimeIntervention(id, metadata)
            : name === "complete_runtime_intervention"
              ? await getClient().completeRuntimeIntervention(id, metadata)
              : await getClient().failRuntimeIntervention(id, metadata);
          break;
        }

        case "list_runtime_state_references":
          result = await getClient().listRuntimeStateReferences({
            runId: args?.run_id as string | undefined,
            referenceType: args?.reference_type as string | undefined,
            provider: args?.provider as string | undefined,
            resourceType: args?.resource_type as string | undefined,
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_runtime_state_reference":
          result = await getClient().getRuntimeStateReference(String(args!.id));
          break;

        case "list_ai_system_assets":
          result = await getClient().listAiSystemAssets({
            assetType: args?.asset_type as string | undefined,
            sourceSystem: args?.source_system as string | undefined,
            lifecycleState: args?.lifecycle_state as string | undefined,
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_ai_system_asset":
          result = await getClient().getAiSystemAsset(String(args!.id));
          break;

        case "list_trajectory_evidence_sets":
          result = await getClient().listEvidenceSets({
            initiativeId: args?.initiative_id as string | undefined,
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_trajectory_evidence_set":
          result = await getClient().getEvidenceSet(String(args!.id));
          break;

        case "preview_trajectory_evidence_set":
          result = await getClient().previewEvidenceSet({
            initiative_id: String(args!.initiative_id), work_item_ids: args!.work_item_ids as string[],
          });
          break;

        case "list_trajectory_selection_rules":
          result = await getClient().listTrajectorySelectionRules({ initiativeId: args?.initiative_id as string | undefined });
          break;

        case "preview_trajectory_selection_rule":
          result = await getClient().previewTrajectorySelectionRule(String(args!.id));
          break;

        case "list_intelligence_runs":
          result = await getClient().listIntelligenceRuns({
            runType: args?.run_type as string | undefined,
            status: args?.status as string | undefined,
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "list_comparison_studies":
          result = await getClient().listComparisonStudies({
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_comparison_study":
          result = await getClient().getComparisonStudy(String(args!.id));
          break;

        case "show_intelligence_run":
          result = await getClient().getIntelligenceRun(String(args!.id));
          break;

        case "list_context_assets":
          result = await getClient().listContextAssets({
            contextType: args?.context_type as string | undefined,
            status: args?.status as string | undefined,
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_context_asset":
          result = await getClient().getContextAsset(String(args!.id));
          break;

        case "upsert_runtime_state_reference": {
          if (!allowRegistryWrites) throw new Error("Runtime writes are disabled. Start MCP with --enable-registry-writes.");
          const data = parseDataObject(args?.data);
          if (hasBlockedSecretField(data)) throw new Error("State references may not contain secrets.");
          result = await getClient().upsertRuntimeStateReference(data);
          break;
        }

        case "freeze_trajectory_evidence_set": {
          if (!allowRegistryWrites) throw new Error("Trajectory writes are disabled. Start MCP with --enable-registry-writes.");
          const data = {
            initiative_id: String(args!.initiative_id),
            name: args?.name as string | undefined,
            work_item_ids: args?.work_item_ids as string[],
            filter_snapshot: args?.filter_snapshot as Record<string, any> | undefined,
          };
          if (hasBlockedSecretField(data)) throw new Error("Evidence metadata may not contain secrets.");
          result = await getClient().createEvidenceSet(data);
          break;
        }

        case "create_trajectory_selection_rule": {
          if (!allowRegistryWrites) throw new Error("Trajectory writes are disabled. Start MCP with --enable-registry-writes.");
          const data = parseDataObject(args?.data);
          if (hasBlockedSecretField(data)) throw new Error("Selection rules may not contain secrets.");
          result = await getClient().createTrajectorySelectionRule(data);
          break;
        }

        case "freeze_trajectory_selection_rule":
          if (!allowRegistryWrites) throw new Error("Trajectory writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().freezeTrajectorySelectionRule(String(args!.id), args?.name as string | undefined);
          break;

        case "record_context_use": {
          if (!allowRegistryWrites) throw new Error("Context writes are disabled. Start MCP with --enable-registry-writes.");
          const data = parseDataObject(args?.data);
          if (hasBlockedSecretField(data)) throw new Error("Context-use receipts may not contain secrets or raw content.");
          result = await getClient().recordContextUse(data);
          break;
        }

        case "start_intelligence_run": {
          if (!allowRegistryWrites) throw new Error("Trajectory writes are disabled. Start MCP with --enable-registry-writes.");
          const data = {
            initiative_id: String(args!.initiative_id), run_type: String(args!.run_type),
            evidence_set_id: args?.evidence_set_id as string | undefined,
            parameters: args?.parameters as Record<string, any> | undefined,
          };
          if (hasBlockedSecretField(data)) throw new Error("Intelligence parameters may not contain secrets.");
          result = await getClient().createIntelligenceRun(data);
          break;
        }

        case "create_comparison_study": {
          if (!allowRegistryWrites) throw new Error("Comparison writes are disabled. Start MCP with --enable-registry-writes.");
          const data = parseDataObject(args?.data);
          if (hasBlockedSecretField(data)) throw new Error("Comparison Studies may not contain secrets or raw content.");
          result = await getClient().createComparisonStudy(data);
          break;
        }

        case "update_comparison_study": {
          if (!allowRegistryWrites) throw new Error("Comparison writes are disabled. Start MCP with --enable-registry-writes.");
          const data = parseDataObject(args?.data);
          if (hasBlockedSecretField(data)) throw new Error("Comparison Studies may not contain secrets or raw content.");
          result = await getClient().updateComparisonStudy(String(args!.id), data);
          break;
        }

        case "run_comparison_study":
          if (!allowRegistryWrites) throw new Error("Comparison writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().runComparisonStudy(String(args!.id));
          break;

        case "create_context_asset_draft": {
          if (!allowRegistryWrites) throw new Error("Context writes are disabled. Start MCP with --enable-registry-writes.");
          const data = parseDataObject(args?.data);
          if (hasBlockedSecretField(data)) throw new Error("Context assets may not contain secrets or raw credential fields.");
          result = await getClient().createContextAsset(data);
          break;
        }

        case "activate_context_asset":
          if (!allowRegistryWrites) throw new Error("Context writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().activateContextAsset(String(args!.id), String(args!.version_id));
          break;

        case "review_context_asset": {
          if (!allowRegistryWrites) throw new Error("Context writes are disabled. Start MCP with --enable-registry-writes.");
          const packet = (args?.validation_packet || {}) as Record<string, any>;
          if (hasBlockedSecretField(packet)) throw new Error("Context validation packets may not contain secrets.");
          result = await getClient().reviewContextAsset(String(args!.id), String(args!.version_id), packet);
          break;
        }

        case "registry_sync_dry_run": {
          const manifest = parseDataObject(args?.manifest, "manifest");
          if (hasBlockedSecretField(manifest)) throw new Error("Registry manifests may not contain secrets.");
          result = await getClient().dryRunRegistrySync(manifest);
          break;
        }

        case "registry_sync_apply": {
          if (!allowRegistryWrites) throw new Error("Registry writes are disabled. Start MCP with --enable-registry-writes.");
          const manifest = parseDataObject(args?.manifest, "manifest");
          if (hasBlockedSecretField(manifest)) throw new Error("Registry manifests may not contain secrets.");
          result = await getClient().applyRegistrySync(manifest);
          break;
        }

        case "show_registry_sync":
          result = await getClient().getRegistrySync(String(args!.id));
          break;

        case "list_mcp_templates":
          result = await getClient().listMcpTemplates();
          break;

        case "show_mcp_template":
          result = await getClient().getMcpTemplate(String(args!.id));
          break;

        case "install_mcp_template":
          if (!allowRegistryWrites) throw new Error("Registry writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().installMcpTemplate(
            String(args!.id),
            args?.secret_reference_id as string | undefined
          );
          break;

        case "list_work_sessions":
          result = await getClient().listWorkItems({
            status: args?.status as string | undefined,
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_work_session":
          result = await getClient().getWorkItem(String(args!.id));
          break;

        case "complete_work_session":
          if (!allowRegistryWrites) throw new Error("Work Session writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().completeWorkItem(String(args!.id));
          break;

        case "preview_work_session_repair":
          if (!allowRegistryWrites) throw new Error("Work Session writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().previewWorkItemRepair(
            String(args!.id),
            parseDataObject(args?.data)
          );
          break;

        case "apply_work_session_repair":
          if (!allowRegistryWrites) throw new Error("Work Session writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().applyWorkItemRepair(
            String(args!.id),
            parseDataObject(args?.data)
          );
          break;

        case "undo_work_session_repair":
          if (!allowRegistryWrites) throw new Error("Work Session writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().undoWorkItemRepair(String(args!.id), {
            repair_id: String(args!.repair_id),
            reason: args?.reason,
          });
          break;

        case "list_inference_feedback":
          result = await getClient().listInferenceFeedback({
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "record_inference_feedback":
          if (!allowRegistryWrites) throw new Error("Feedback writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().createInferenceFeedback(parseDataObject(args?.data));
          break;

        case "propose_outcome":
          if (!allowRegistryWrites) throw new Error("Outcome writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().createOutcomeProposal({
            key: args!.key,
            name: args!.name,
            description: args?.description,
            work_item_id: args?.work_item_id,
          });
          break;

        case "list_initiatives":
          result = await getClient().listInitiatives({
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_initiative":
          result = await getClient().getInitiative(String(args!.id));
          break;

        case "list_compliance_risks":
          result = await getClient().listComplianceRisks({
            status: args?.status as string | undefined,
            category: args?.category as string | undefined,
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_compliance_risk":
          result = await getClient().getComplianceRisk(String(args!.id));
          break;

        case "validate_compliance":
          result = await getClient().validateCompliance(parseDataObject(args?.data));
          break;

        case "show_compliance_evidence":
          result = await getClient().getComplianceEvidence(String(args!.id));
          break;

        case "show_compliance_certification":
          result = await getClient().getComplianceCertification(String(args!.id));
          break;

        case "create_compliance_source_run":
          if (!allowRegistryWrites) throw new Error("Compliance writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().createComplianceSourceRun(parseDataObject(args?.data));
          break;

        case "submit_compliance_source_results":
          if (!allowRegistryWrites) throw new Error("Compliance writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().submitComplianceSourceResults(
            String(args!.id),
            parseDataObject(args?.data)
          );
          break;

        case "complete_compliance_source_run":
          if (!allowRegistryWrites) throw new Error("Compliance writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().completeComplianceSourceRun(
            String(args!.id),
            String(args!.completeness)
          );
          break;

        case "flush_inference_capture":
          if (!allowRegistryWrites) throw new Error("Capture writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().flushInferenceCapture();
          break;

        case "retry_tenant_resource_sync":
          if (!allowRegistryWrites) throw new Error("Registry writes are disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().retryTenantResourceSync(
            String(args!.resource),
            String(args!.id)
          );
          break;

        case "verify_tenant_secret_reference":
          if (!allowRegistryWrites) throw new Error("Secret-reference verification is disabled. Start MCP with --enable-registry-writes.");
          result = await getClient().verifyTenantResource(
            String(args!.resource),
            String(args!.id)
          );
          break;

        case "record_outcome":
          if (!allowRegistryWrites) {
            throw new Error("Outcome write tools are disabled. Start MCP with --enable-registry-writes.");
          }
          result = await getClient().createTrace(outcomeTracePayload(args as Record<string, any>));
          break;

        case "map_outcome":
          if (!allowRegistryWrites) {
            throw new Error("Outcome mapping tools are disabled. Start MCP with --enable-registry-writes.");
          }
          result = await getClient().createOutcomeMappingRule(compactPayload({
            outcome_key: args!.outcome_key,
            match_criteria: args!.match_criteria,
            name: args?.name,
            priority: args?.priority,
            enabled: args?.enabled,
          }));
          break;

        case "accept_insight":
          if (!allowRegistryWrites) {
            throw new Error("Insight action tools are disabled. Start MCP with --enable-registry-writes.");
          }
          result = await getClient().acceptInsight(args!.id as string);
          break;

        case "apply_insight":
          if (!allowRegistryWrites) {
            throw new Error("Insight action tools are disabled. Start MCP with --enable-registry-writes.");
          }
          result = await getClient().applyInsight(args!.id as string);
          break;

        case "list_policy_decisions":
          result = await getClient().listPolicyDecisions({
            decision_action: args?.decision_action as string | undefined,
            policy_action: args?.policy_action as string | undefined,
            evaluation_mode: args?.evaluation_mode as string | undefined,
            run_id: args?.run_id as string | undefined,
            request_id: args?.request_id as string | undefined,
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_policy_decision":
          result = await getClient().getPolicyDecision(args!.id as string);
          break;

        case "list_policy_templates":
          result = await getClient().listPolicyTemplates();
          break;

        case "render_policy_template": {
          const templateParams = args?.template_params === undefined
            ? {}
            : parseDataObject(args.template_params, "template_params");
          if (hasBlockedSecretField(templateParams)) {
            throw new Error("MCP refuses raw secret-bearing template parameters. Use credential_source_id references or remove secrets.");
          }
          result = await getClient().renderPolicyTemplate(args!.id as string, templateParams);
          break;
        }

        case "generate_policy_draft": {
          const prompt = String(args?.prompt || "");
          if (hasBlockedSecretText(prompt)) {
            throw new Error("MCP refuses to send secret-looking text to policy draft generation. Remove keys, tokens, passwords, and secrets.");
          }
          result = await getClient().generatePolicyDraft({
            prompt,
            scope: args?.scope as string | undefined,
          });
          break;
        }

        case "list_approvals":
          result = await getClient().listApprovals({
            status: args?.status as string | undefined,
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;

        case "show_approval":
          result = await getClient().getApproval(args!.id as string);
          break;

        case "approve_approval":
          result = await getClient().approveApproval(args!.id as string);
          break;

        case "deny_approval":
          result = await getClient().denyApproval(args!.id as string);
          break;

        case "list_tenant_resources":
          result = {
            resources: TENANT_RESOURCE_NAMES,
            notes: [
              "Internal /internal/inference/* routes are intentionally not exposed.",
              "MCP refuses inference-key creation and raw secret fields; use CLI/web UI for those workflows.",
            ],
          };
          break;

        case "tenant_resource_list": {
          const resource = assertTenantResourceName(args?.resource);
          result = await getClient().listTenantResource(resource, {
            limit: args?.limit as number | undefined,
            offset: args?.offset as number | undefined,
          });
          break;
        }

        case "tenant_resource_show": {
          const resource = assertTenantResourceName(args?.resource);
          result = await getClient().getTenantResource(resource, args!.id as string);
          break;
        }

        case "tenant_resource_create": {
          const resource = assertTenantResourceName(args?.resource);
          const data = parseDataObject(args?.data);
          assertSafeMcpMutation(resource, data);
          result = await getClient().createTenantResource(resource, data);
          break;
        }

        case "tenant_resource_update": {
          const resource = assertTenantResourceName(args?.resource);
          const data = parseDataObject(args?.data);
          assertSafeMcpMutation(resource, data);
          result = await getClient().updateTenantResource(resource, args!.id as string, data);
          break;
        }

        case "tenant_resource_delete": {
          const resource = assertTenantResourceName(args?.resource);
          result = await getClient().deleteTenantResource(resource, args!.id as string);
          break;
        }

        case "tenant_resource_validate": {
          const resource = assertTenantResourceName(args?.resource);
          if (![
            "model_deployments",
            "mcp_servers",
            "tenant_agents",
            "tenant_skills",
            "guardrail_policies",
            "governance_policies",
          ].includes(resource)) {
            throw new Error("Validation is not available for this tenant resource.");
          }
          const data = parseDataObject(args?.data);
          if (hasBlockedSecretField(data)) {
            throw new Error("MCP refuses raw secret-bearing validation payloads. Use synthetic sample values instead.");
          }
          result = await getClient().validateTenantResource(resource, data);
          break;
        }

        case "test_governance_policy":
          result = await getClient().testGovernancePolicy(
            args!.id as string,
            parseDataObject(args?.context, "context"),
          );
          break;

        case "tenant_team_list":
          result = await getClient().getTenantTeam();
          break;

        case "tenant_team_invite":
          result = await getClient().inviteTenantMember({
            email: args!.email as string,
            role: args?.role as string | number | undefined,
          });
          break;

        case "tenant_team_set_inference_role":
          result = await getClient().updateTenantMember(args!.member_id as string, {
            inference_role_id: (args?.inference_role_id ?? null) as string | null,
          });
          break;

        case "tenant_team_disable":
          result = await getClient().setTenantMemberEnabled(args!.member_id as string, false);
          break;

        case "tenant_team_enable":
          result = await getClient().setTenantMemberEnabled(args!.member_id as string, true);
          break;

        case "tenant_team_remove":
          result = await getClient().deleteTenantMember(args!.member_id as string);
          break;

        case "tenant_invitation_cancel":
          result = await getClient().cancelTenantInvitation(args!.invitation_id as string);
          break;

        case "tenant_domains_update":
          result = await getClient().updateTenantDomains((args!.domains as string[]) || []);
          break;

        case "inference_capture_show":
          result = await getClient().getInferenceCaptureConfig();
          break;

        case "inference_capture_update": {
          const data = parseDataObject(args?.data);
          assertSafeMcpMutation("inference_capture", data);
          result = await getClient().updateInferenceCaptureConfig(data);
          break;
        }

        // --- Agents ---
        case "list_agents":
          result = await getClient().listAgents();
          break;

        case "show_agent":
          result = await getClient().getAgent(args!.agent_id as string);
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
