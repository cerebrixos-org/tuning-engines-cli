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
exports.registerOrchestrationCommands = registerOrchestrationCommands;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const FRAMEWORKS = [
    "langgraph",
    "temporal",
    "inngest",
    "triggerdev",
    "hatchet",
    "restate",
    "dbos",
    "dapr",
    "prefect",
    "dagster",
    "airflow",
];
const FRAMEWORK_LABELS = {
    langgraph: "LangGraph",
    temporal: "Temporal",
    inngest: "Inngest",
    triggerdev: "Trigger.dev",
    hatchet: "Hatchet",
    restate: "Restate",
    dbos: "DBOS",
    dapr: "Dapr Workflow",
    prefect: "Prefect",
    dagster: "Dagster",
    airflow: "Airflow",
};
function registerOrchestrationCommands(program) {
    const orchestration = program
        .command("orchestration")
        .description("Create orchestration starter kits wired to Tuning Engines");
    orchestration
        .command("init <framework>")
        .description(`Create a governed orchestration starter kit: ${FRAMEWORKS.join(", ")}`)
        .option("--dir <path>", "Output directory")
        .option("--force", "Overwrite existing files")
        .action((framework, opts) => {
        const normalized = framework.toLowerCase();
        if (!FRAMEWORKS.includes(normalized)) {
            console.error(`framework must be one of: ${FRAMEWORKS.join(", ")}`);
            process.exit(1);
        }
        const targetDir = path.resolve(opts.dir || `tuning-engines-${normalized}`);
        writeTemplate(targetDir, normalized, Boolean(opts.force));
        console.log(`Created ${normalized} starter kit at ${targetDir}`);
        console.log("Set TE_INFERENCE_KEY, then follow the README in that directory.");
    });
}
function writeTemplate(targetDir, framework, force) {
    fs.mkdirSync(targetDir, { recursive: true });
    const files = filesFor(framework);
    for (const [name, content] of Object.entries(files)) {
        const filePath = path.join(targetDir, name);
        if (fs.existsSync(filePath) && !force) {
            throw new Error(`${filePath} already exists. Re-run with --force to overwrite.`);
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, "utf8");
    }
}
function filesFor(framework) {
    switch (framework) {
        case "langgraph":
            return langgraphFiles();
        case "temporal":
            return temporalFiles();
        case "inngest":
            return nodeStarterFiles(framework, inngestSource());
        case "triggerdev":
            return nodeStarterFiles(framework, triggerdevSource(), "trigger/governed-ai.ts");
        case "hatchet":
            return nodeStarterFilesWithHatchet(framework, hatchetSource(), "src/workflows/tuning-engines-workflow.ts");
        case "restate":
            return nodeStarterFiles(framework, restateSource(), "src/restate-service.ts");
        case "dbos":
            return nodeStarterFiles(framework, dbosSource(), "src/workflow.ts");
        case "dapr":
            return nodeStarterFiles(framework, daprSource(), "src/workflow.ts");
        case "prefect":
            return pythonWorkflowFiles(framework, prefectSource());
        case "dagster":
            return pythonWorkflowFiles(framework, dagsterSource(), "definitions.py");
        case "airflow":
            return pythonWorkflowFiles(framework, airflowSource(), "dags/tuning_engines_dag.py");
    }
}
function sharedReadme(framework) {
    const label = FRAMEWORK_LABELS[framework];
    return `# Tuning Engines ${label} starter

This starter keeps ${label} in charge of orchestration state while Tuning Engines governs model, MCP, agent, and skill access.

## Configure

\`\`\`bash
cp .env.example .env
export TE_INFERENCE_KEY=sk-te-your-inference-key
export TE_MODEL=auto
\`\`\`

Use a user API token \`te_...\` for CLI/admin actions such as \`te approvals list\` and \`te traces show\`.
Use an inference key \`sk-te-...\` for model, MCP, agent, skill, trace-ingest, and state-reference calls.

## Approval flow

When an AGT YAML policy returns \`needs_approval\`, the proxy returns \`approval_required\` with an approval id.
Tenant owners/admins can review it in-app or with:

\`\`\`bash
te approvals list --status pending
te approvals approve <approval-id>
\`\`\`

The retry must include the same request context plus the approval id. The helper in this starter shows the pattern.

## Decision traces

Every model, MCP, agent, skill, approval, and runtime event should carry:

- \`run_id\`: one durable workflow/graph/run id.
- \`request_id\`: one request/span id, generated as \`req_...\`.
- normalized event \`type\`: for example \`model.call\`, \`mcp.tool_call\`, \`agent.message\`, \`workflow.step\`, \`human.edit\`, \`action.finalized\`, \`outcome.recorded\`, or \`state.reference\`.

For the compounding-loop signal, record redacted decision metadata only:
\`proposal_summary\`, \`changed_fields\`, \`change_summary\`, \`final_action\`,
\`outcome_label\`, and \`reason_summary\`. Do not put raw prompts, provider keys,
tenant secrets, or full customer data into trace metadata.
`;
}
function langgraphFiles() {
    return {
        "README.md": sharedReadme("langgraph") + `
## Run

\`\`\`bash
pip install "tuning-agents[langgraph] @ git+https://github.com/cerebrixos-org/tuning-engines-cli.git#subdirectory=packages/tuning-agents"
python app.py
\`\`\`
`,
        ".env.example": envExample("langgraph"),
        "tuning-registry.yml": registryManifest("langgraph"),
        "app.py": `import os
import uuid

from langgraph.checkpoint.memory import InMemorySaver

from tuning_agents import TuningClient, TuningError
from tuning_agents.langgraph import create_tuning_langgraph_agent, invoke_with_trace
from tuning_agents.mcp import skill_tool_spec


RUN_ID = f"lg_{uuid.uuid4().hex}"


def policy_context(resource_name: str) -> dict:
    return {
        "run_id": RUN_ID,
        "request_id": f"req_{uuid.uuid4().hex}",
        "runtime": "langgraph",
        "resource_name": resource_name,
    }


def main() -> None:
    client = TuningClient(
        api_key=os.environ["TE_INFERENCE_KEY"],
        api_url=os.getenv("TE_API_URL", "https://app.tuningengines.com"),
        inference_url=os.getenv("TE_INFERENCE_URL", "https://api.tuningengines.com/v1"),
    )

    model = os.getenv("TE_MODEL", "auto")
    skill = skill_tool_spec("summarize", description="Summarize text under tenant policy.")

    def governed_model_call(approval_id: str | None = None):
        return client.chat(
            model=model,
            messages=[{"role": "user", "content": "Say hello from a governed LangGraph node."}],
            tools=[skill],
            metadata=policy_context("summarize"),
            approval_id=approval_id,
        )

    try:
        proposal_event = client.trace.start(
            "agent.message",
            {
                "request_id": f"req_{uuid.uuid4().hex}",
                "decision": client.trace.decision(
                    proposal_summary="Call the governed model from LangGraph.",
                    changed_fields=[],
                ),
            },
        )
        governed_model_call()
        client.trace.finish(
            proposal_event,
            {
                "decision": client.trace.decision(
                    final_action="model.call",
                    outcome_label="success",
                    reason_summary="Provider call completed through Tuning Engines.",
                ),
            },
        )
        client.upsert_state_reference({
            "reference_type": "langgraph_checkpoint",
            "runtime": "langgraph",
            "provider": "langgraph",
            "external_id": RUN_ID,
            "run_id": RUN_ID,
            "status": "active",
            "metadata": {"checkpoint_store": "InMemorySaver"},
        })
    except TuningError as exc:
        print("Model call needs attention:", exc)

    # MCP call example. Replace names with your registry entries.
    # client.call_mcp_tool(
    #     server_name="mcp-express-sse-server",
    #     tool_name="echo",
    #     arguments={"text": "hello"},
    # )

    # Agent call example. Replace with your tenant agent name.
    # client.call_agent(agent_name="support-agent", message="Triage this ticket.")

    agent = create_tuning_langgraph_agent(
        client,
        model=model,
        checkpointer=InMemorySaver(),
        interrupt_before=["tools"],
    )
    invoke_with_trace(
        client,
        agent,
        [{"role": "user", "content": "Use the governed runtime."}],
        thread_id=RUN_ID,
    )
    client.flush_trace(name="langgraph-governed-demo", runtime="langgraph", status="succeeded")


if __name__ == "__main__":
    main()
`,
    };
}
function temporalFiles() {
    return {
        "README.md": sharedReadme("temporal") + `
## Run

\`\`\`bash
pip install "tuning-agents[temporal] @ git+https://github.com/cerebrixos-org/tuning-engines-cli.git#subdirectory=packages/tuning-agents"
python worker.py
\`\`\`
`,
        ".env.example": envExample("temporal"),
        "tuning-registry.yml": registryManifest("temporal"),
        "worker.py": `import asyncio
import os
import uuid
from datetime import timedelta

from temporalio import activity, workflow
from temporalio.client import Client
from temporalio.worker import Worker

from tuning_agents import TuningClient, TuningError


def policy_context(resource_name: str, run_id: str) -> dict:
    return {
        "run_id": run_id,
        "request_id": f"req_{uuid.uuid4().hex}",
        "runtime": "temporal",
        "resource_name": resource_name,
    }


@activity.defn
async def governed_model_activity(prompt: str, approval_id: str | None = None) -> dict:
    client = TuningClient(
        api_key=os.environ["TE_INFERENCE_KEY"],
        api_url=os.getenv("TE_API_URL", "https://app.tuningengines.com"),
        inference_url=os.getenv("TE_INFERENCE_URL", "https://api.tuningengines.com/v1"),
    )
    run_id = activity.info().workflow_id
    try:
        response = client.chat(
            model=os.getenv("TE_MODEL", "auto"),
            messages=[{"role": "user", "content": prompt}],
            metadata=policy_context("temporal-model-call", run_id),
            approval_id=approval_id,
        )
        client.trace.start(
            "state.reference",
            {
                "request_id": f"req_{uuid.uuid4().hex}",
                "state_reference": {
                    "reference_type": "temporal_workflow",
                    "runtime": "temporal",
                    "provider": "temporal",
                    "external_id": run_id,
                    "run_id": run_id,
                    "status": "active",
                    "metadata": {
                        "namespace": activity.info().workflow_namespace,
                        "task_queue": activity.info().task_queue,
                    },
                },
            },
        )
        client.upsert_state_reference({
            "reference_type": "temporal_workflow",
            "runtime": "temporal",
            "provider": "temporal",
            "external_id": run_id,
            "run_id": run_id,
            "status": "active",
            "metadata": {
                "namespace": activity.info().workflow_namespace,
                "task_queue": activity.info().task_queue,
            },
        })
        client.trace.start(
            "outcome.recorded",
            {
                "request_id": f"req_{uuid.uuid4().hex}",
                "decision": client.trace.decision(
                    final_action="model.call",
                    outcome_label="success",
                    reason_summary="Temporal activity completed through Tuning Engines.",
                ),
            },
        )
        client.flush_trace(name="temporal-governed-demo", runtime="temporal", status="succeeded")
        return response.model_dump(mode="json") if hasattr(response, "model_dump") else response
    except TuningError:
        client.flush_trace(name="temporal-governed-demo", runtime="temporal", status="failed")
        raise


@activity.defn
async def mcp_tool_activity(server_name: str, tool_name: str, arguments: dict) -> dict:
    client = TuningClient(api_key=os.environ["TE_INFERENCE_KEY"])
    return await client.acall_mcp_tool(server_name=server_name, tool_name=tool_name, arguments=arguments)


@activity.defn
async def agent_activity(agent_name: str, message: str) -> dict:
    client = TuningClient(api_key=os.environ["TE_INFERENCE_KEY"])
    return await client.acall_agent(agent_name=agent_name, message=message)


@workflow.defn
class GovernedWorkflow:
    @workflow.run
    async def run(self, prompt: str) -> dict:
        return await workflow.execute_activity(
            governed_model_activity,
            prompt,
            start_to_close_timeout=timedelta(minutes=2),
        )


async def main() -> None:
    temporal = await Client.connect(os.getenv("TEMPORAL_ADDRESS", "localhost:7233"))
    worker = Worker(
        temporal,
        task_queue=os.getenv("TEMPORAL_TASK_QUEUE", "tuning-engines-demo"),
        workflows=[GovernedWorkflow],
        activities=[governed_model_activity, mcp_tool_activity, agent_activity],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
`,
    };
}
function nodeStarterFiles(framework, entrypoint, entrypointPath = "src/workflow.ts") {
    return {
        "README.md": nodeReadme(framework, entrypointPath),
        ".env.example": envExample(framework),
        "package.json": nodePackageJson(framework),
        "tsconfig.json": nodeTsconfig(),
        "tuning-registry.yml": registryManifest(framework),
        "src/tuning-engines.ts": tuningEnginesNodeHelper(),
        [entrypointPath]: entrypoint,
    };
}
function nodeReadme(framework, entrypointPath) {
    const label = FRAMEWORK_LABELS[framework];
    return sharedReadme(framework) + `
## Install

\`\`\`bash
npm install
cp .env.example .env
\`\`\`

## Generated files

- \`${entrypointPath}\`: ${label} workflow/task example.
- \`src/tuning-engines.ts\`: small helper for governed model calls, trace ingest, approvals, MCP/agent/skill calls, and state references.
- \`tuning-registry.yml\`: manifest skeleton for registry sync.

## Run

\`\`\`bash
npm run typecheck
\`\`\`

Then run the ${label} worker/dev server using the normal ${label} workflow for your app.
`;
}
function nodePackageJson(framework) {
    const deps = {};
    if (framework === "inngest")
        deps.inngest = "^3.40.0";
    if (framework === "triggerdev")
        deps["@trigger.dev/sdk"] = "^4.0.0";
    if (framework === "hatchet")
        deps["@hatchet-dev/typescript-sdk"] = "^1.22.0";
    if (framework === "restate")
        deps["@restatedev/restate-sdk"] = "^1.14.4";
    if (framework === "dbos")
        deps["@dbos-inc/dbos-sdk"] = "^4.0.0";
    if (framework === "dapr")
        deps["@dapr/dapr"] = "^3.5.0";
    return `${JSON.stringify({
        name: `tuning-engines-${framework}-starter`,
        private: true,
        type: "module",
        scripts: {
            typecheck: "tsc --noEmit",
        },
        dependencies: deps,
        devDependencies: {
            "@types/node": "^20.0.0",
            typescript: "^5.4.0",
        },
    }, null, 2)}
`;
}
function nodeTsconfig() {
    return `${JSON.stringify({
        compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            outDir: "dist",
        },
        include: ["src/**/*.ts", "trigger/**/*.ts"],
    }, null, 2)}
`;
}
function pythonWorkflowFiles(framework, source, entrypointPath = "workflow.py") {
    const helperPath = framework === "airflow" ? "dags/tuning_engines_client.py" : "tuning_engines_client.py";
    return {
        "README.md": pythonReadme(framework, entrypointPath, helperPath),
        ".env.example": envExample(framework),
        "requirements.txt": pythonRequirements(framework),
        "tuning-registry.yml": registryManifest(framework),
        [helperPath]: tuningEnginesPythonHelper(),
        [entrypointPath]: source,
    };
}
function pythonReadme(framework, entrypointPath, helperPath) {
    const label = FRAMEWORK_LABELS[framework];
    return sharedReadme(framework) + `
## Install

\`\`\`bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
\`\`\`

## Generated files

- \`${entrypointPath}\`: ${label} workflow example.
- \`${helperPath}\`: small helper for governed model calls, trace ingest, approvals, and state references.
- \`tuning-registry.yml\`: manifest skeleton for registry sync.

Run the workflow using the normal ${label} development flow for your app.
`;
}
function pythonRequirements(framework) {
    const lines = ["httpx>=0.27"];
    if (framework === "prefect")
        lines.push("prefect>=3.0");
    if (framework === "dagster")
        lines.push("dagster>=1.8");
    if (framework === "airflow")
        lines.push("apache-airflow>=2.10");
    return `${lines.join("\n")}\n`;
}
function envExample(framework) {
    const extra = framework === "temporal"
        ? `TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_TASK_QUEUE=tuning-engines-demo
`
        : framework === "hatchet"
            ? `HATCHET_CLIENT_TOKEN=hatchet-token
HATCHET_CLIENT_HOST_PORT=localhost:7077
`
            : framework === "triggerdev"
                ? `TRIGGER_SECRET_KEY=tr_dev_your-trigger-secret
`
                : framework === "dapr"
                    ? `DAPR_HOST=127.0.0.1
DAPR_HTTP_PORT=3500
`
                    : framework === "inngest"
                        ? `INNGEST_EVENT_KEY=local
INNGEST_SIGNING_KEY=local
`
                        : "";
    return `TE_INFERENCE_KEY=sk-te-your-inference-key
TE_API_URL=https://app.tuningengines.com
TE_INFERENCE_URL=https://api.tuningengines.com/v1
TE_MODEL=auto
${extra}`;
}
function registryManifest(framework) {
    return `version: 1
source: ${framework}
resources:
  mcp_servers:
    - name: customer-memory
      description: Customer-owned memory exposed through MCP resources/tools.
      endpoint_url: https://example.com/mcp
      auth_method: credential_source
      credential_source_id: replace-with-credential-source-id
      enabled: false
      external_ref: ${framework}:customer-memory
      metadata:
        runtime: ${framework}
        safe_to_sync: true
  tenant_agents:
    - name: support-agent
      description: Existing agent endpoint invoked from ${FRAMEWORK_LABELS[framework]}.
      endpoint_url: https://example.com/agents/support
      auth_method: credential_source
      credential_source_id: replace-with-credential-source-id
      enabled: false
      external_ref: ${framework}:support-agent
      metadata:
        runtime: ${framework}
  tenant_skills:
    - name: summarize-ticket
      description: Skill package used by the governed workflow.
      source_url: https://example.com/skills/summarize-ticket/SKILL.md
      enabled: false
      external_ref: ${framework}:summarize-ticket
      metadata:
        runtime: ${framework}
`;
}
function tuningEnginesNodeHelper() {
    return `import { randomUUID } from "node:crypto";

export type TraceEvent = {
  id: string;
  type: string;
  status?: string;
  parent_id?: string;
  metadata?: Record<string, unknown>;
};

export type StateReference = {
  reference_type:
    | "langgraph_checkpoint"
    | "temporal_workflow"
    | "vector_namespace"
    | "memory_record"
    | "mcp_resource"
    | "external_context";
  runtime: string;
  provider?: string;
  external_id?: string;
  uri?: string;
  key?: string;
  run_id?: string;
  request_id?: string;
  resource_type?: string;
  resource_name?: string;
  resource_id?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

const TE_API_URL = (process.env.TE_API_URL || "https://app.tuningengines.com").replace(/\\/$/, "");
const TE_INFERENCE_URL = (process.env.TE_INFERENCE_URL || "https://api.tuningengines.com/v1").replace(/\\/$/, "");
const TE_INFERENCE_KEY = process.env.TE_INFERENCE_KEY || process.env.TE_API_KEY;
const TE_MODEL = process.env.TE_MODEL || "auto";

export function newId(prefix: string): string {
  return prefix + "_" + randomUUID().replace(/-/g, "");
}

function requireKey(): string {
  if (!TE_INFERENCE_KEY) {
    throw new Error("Set TE_INFERENCE_KEY before running this starter.");
  }
  return TE_INFERENCE_KEY;
}

async function teFetch(url: string, init: RequestInit = {}, approvalId?: string): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + requireKey());
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (approvalId) headers.set("X-TE-Approval-ID", approvalId);

  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error("Tuning Engines request failed: " + response.status);
    (error as Error & { payload?: unknown }).payload = payload;
    throw error;
  }
  return payload;
}

export async function chat(options: {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  metadata: Record<string, unknown>;
  approvalId?: string;
}): Promise<unknown> {
  const requestId = String(options.metadata.request_id || newId("req"));
  const runId = String(options.metadata.run_id || newId("run"));
  return teFetch(
    TE_INFERENCE_URL + "/chat/completions",
    {
      method: "POST",
      headers: {
        "X-TE-Request-ID": requestId,
        "X-TE-Run-ID": runId,
      },
      body: JSON.stringify({
        model: options.model || TE_MODEL,
        messages: options.messages,
        metadata: {
          ...options.metadata,
          request_id: requestId,
          run_id: runId,
          agent_run_id: runId,
          event_type: "model.call",
        },
      }),
    },
    options.approvalId,
  );
}

export async function callMcpTool(options: {
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  approvalId?: string;
}): Promise<unknown> {
  return teFetch(
    TE_INFERENCE_URL.replace(/\\/v1$/, "") + "/v1/mcp/tools/call",
    {
      method: "POST",
      body: JSON.stringify({
        server_name: options.serverName,
        tool_name: options.toolName,
        arguments: options.arguments || {},
        metadata: {
          ...options.metadata,
          event_type: "mcp.tool_call",
        },
      }),
    },
    options.approvalId,
  );
}

export async function callAgent(options: {
  agentName: string;
  message: string;
  context?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  approvalId?: string;
}): Promise<unknown> {
  return teFetch(
    TE_INFERENCE_URL.replace(/\\/v1$/, "") + "/v1/agents/" + encodeURIComponent(options.agentName) + "/message",
    {
      method: "POST",
      body: JSON.stringify({
        message: { role: "user", content: options.message },
        context: options.context || {},
        metadata: {
          ...options.metadata,
          event_type: "agent.message",
        },
      }),
    },
    options.approvalId,
  );
}

export async function emitTrace(options: {
  runId: string;
  name: string;
  runtime: string;
  status?: string;
  events: TraceEvent[];
  metadata?: Record<string, unknown>;
}): Promise<unknown> {
  return teFetch(TE_API_URL + "/api/v1/traces", {
    method: "POST",
    body: JSON.stringify({
      run_id: options.runId,
      name: options.name,
      runtime: options.runtime,
      status: options.status || "running",
      metadata: options.metadata || {},
      events: options.events,
    }),
  });
}

export async function upsertStateReference(reference: StateReference): Promise<unknown> {
  return teFetch(TE_API_URL + "/api/v1/runtime_state_references", {
    method: "POST",
    body: JSON.stringify({ runtime_state_reference: reference }),
  });
}

export function approvalRetryHint(error: unknown): string | null {
  const payload = (error as { payload?: { error?: unknown; approval_id?: unknown; retry?: unknown } }).payload;
  if (!payload || payload.error !== "approval_required") return null;
  return "Approve " + String(payload.approval_id) + " in Tuning Engines, then retry with approvalId set.";
}
`;
}
function inngestSource() {
    return `import { Inngest } from "inngest";
import { approvalRetryHint, chat, emitTrace, newId, upsertStateReference } from "./tuning-engines.js";

export const inngest = new Inngest({ id: "tuning-engines-demo" });

export const governedAiWorkflow = inngest.createFunction(
  { id: "tuning-engines-governed-ai" },
  { event: "te/demo.requested" },
  async ({ event, step, runId }) => {
    const run_id = String(event.data?.run_id || "inngest_" + runId);
    const request_id = newId("req");
    const prompt = String(event.data?.prompt || "Say hello from a governed Inngest workflow.");

    await step.run("link-inngest-state", async () => {
      await upsertStateReference({
        reference_type: "external_context",
        runtime: "inngest",
        provider: "inngest",
        external_id: runId,
        run_id,
        request_id,
        status: "active",
        metadata: {
          event_name: event.name,
          function_id: "tuning-engines-governed-ai",
        },
      });
    });

    await emitTrace({
      runId: run_id,
      name: "inngest-governed-ai",
      runtime: "inngest",
      events: [
        {
          id: newId("evt"),
          type: "workflow.step",
          status: "started",
          metadata: {
            run_id,
            request_id,
            resource_type: "inngest_function",
            resource_name: "tuning-engines-governed-ai",
          },
        },
      ],
    });

    try {
      const response = await step.run("governed-model-call", async () => {
        return chat({
          messages: [{ role: "user", content: prompt }],
          metadata: {
            run_id,
            request_id,
            runtime: "inngest",
            resource_type: "model",
            resource_name: "governed-model",
          },
        });
      });

      await emitTrace({
        runId: run_id,
        name: "inngest-governed-ai",
        runtime: "inngest",
        status: "succeeded",
        events: [
          {
            id: newId("evt"),
            type: "outcome.recorded",
            status: "succeeded",
            metadata: {
              run_id,
              request_id,
              decision: {
                final_action: "model.call",
                outcome_label: "success",
                reason_summary: "Inngest step completed through Tuning Engines.",
                redaction_version: "decision-redacted-v1",
              },
            },
          },
        ],
      });

      return { run_id, response };
    } catch (error) {
      const hint = approvalRetryHint(error);
      if (hint) {
        await emitTrace({
          runId: run_id,
          name: "inngest-governed-ai",
          runtime: "inngest",
          status: "waiting",
          events: [
            {
              id: newId("evt"),
              type: "approval.requested",
              status: "pending",
              metadata: { run_id, request_id, hint },
            },
          ],
        });
      }
      throw error;
    }
  },
);
`;
}
function triggerdevSource() {
    return `import { task } from "@trigger.dev/sdk";
import { approvalRetryHint, chat, emitTrace, newId, upsertStateReference } from "../src/tuning-engines.js";

export const governedAiTask = task({
  id: "tuning-engines-governed-ai",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: { prompt?: string; run_id?: string; approval_id?: string }, { ctx }) => {
    const run_id = payload.run_id || "trigger_" + ctx.run.id;
    const request_id = newId("req");
    const prompt = payload.prompt || "Say hello from a governed Trigger.dev task.";

    await upsertStateReference({
      reference_type: "external_context",
      runtime: "triggerdev",
      provider: "trigger.dev",
      external_id: ctx.run.id,
      run_id,
      request_id,
      status: "active",
      metadata: {
        task_id: "tuning-engines-governed-ai",
        attempt: (ctx.run as { attempt?: { number?: number } }).attempt?.number,
      },
    });

    try {
      const response = await chat({
        messages: [{ role: "user", content: prompt }],
        approvalId: payload.approval_id,
        metadata: {
          run_id,
          request_id,
          runtime: "triggerdev",
          resource_type: "model",
          resource_name: "governed-model",
        },
      });

      await emitTrace({
        runId: run_id,
        name: "triggerdev-governed-ai",
        runtime: "triggerdev",
        status: "succeeded",
        events: [
          {
            id: newId("evt"),
            type: "workflow.step",
            status: "succeeded",
            metadata: {
              run_id,
              request_id,
              resource_type: "trigger_task",
              resource_name: "tuning-engines-governed-ai",
            },
          },
          {
            id: newId("evt"),
            type: "outcome.recorded",
            status: "succeeded",
            metadata: {
              run_id,
              request_id,
              decision: {
                final_action: "model.call",
                outcome_label: "success",
                reason_summary: "Trigger.dev task completed through Tuning Engines.",
                redaction_version: "decision-redacted-v1",
              },
            },
          },
        ],
      });

      return { run_id, response };
    } catch (error) {
      const hint = approvalRetryHint(error);
      if (hint) {
        await emitTrace({
          runId: run_id,
          name: "triggerdev-governed-ai",
          runtime: "triggerdev",
          status: "waiting",
          events: [
            {
              id: newId("evt"),
              type: "approval.requested",
              status: "pending",
              metadata: { run_id, request_id, hint },
            },
          ],
        });
      }
      throw error;
    }
  },
});
`;
}
function hatchetSource() {
    return `import { hatchet } from "../hatchet-client.js";
import { chat, emitTrace, newId, upsertStateReference } from "../tuning-engines.js";

type Input = {
  prompt: string;
  run_id?: string;
  approval_id?: string;
};

type Output = {
  "governed-model-call": {
    run_id: string;
    response: any;
  };
};

export const governedAiWorkflow = hatchet.workflow<Input, Output>({
  name: "tuning-engines-governed-ai",
});

governedAiWorkflow.task({
  name: "governed-model-call",
  fn: async (input) => {
    const run_id = input.run_id || newId("hatchet");
    const request_id = newId("req");

    await upsertStateReference({
      reference_type: "external_context",
      runtime: "hatchet",
      provider: "hatchet",
      external_id: run_id,
      run_id,
      request_id,
      status: "active",
      metadata: {
        workflow_name: "tuning-engines-governed-ai",
        task_name: "governed-model-call",
      },
    });

    const response = await chat({
      messages: [{ role: "user", content: input.prompt || "Say hello from a governed Hatchet workflow." }],
      approvalId: input.approval_id,
      metadata: {
        run_id,
        request_id,
        runtime: "hatchet",
        resource_type: "model",
        resource_name: "governed-model",
      },
    });

    await emitTrace({
      runId: run_id,
      name: "hatchet-governed-ai",
      runtime: "hatchet",
      status: "succeeded",
      events: [
        {
          id: newId("evt"),
          type: "workflow.step",
          status: "succeeded",
          metadata: {
            run_id,
            request_id,
            resource_type: "hatchet_task",
            resource_name: "governed-model-call",
          },
        },
        {
          id: newId("evt"),
          type: "outcome.recorded",
          status: "succeeded",
          metadata: {
            run_id,
            request_id,
            decision: {
              final_action: "model.call",
              outcome_label: "success",
              reason_summary: "Hatchet task completed through Tuning Engines.",
              redaction_version: "decision-redacted-v1",
            },
          },
        },
      ],
    });

    return { run_id, response };
  },
});
`;
}
function hatchetExtraFiles() {
    return {
        "src/hatchet-client.ts": `import { HatchetClient } from "@hatchet-dev/typescript-sdk";

export const hatchet = HatchetClient.init();
`,
        "src/worker.ts": `import { hatchet } from "./hatchet-client.js";
import { governedAiWorkflow } from "./workflows/tuning-engines-workflow.js";

async function main() {
  const worker = await hatchet.worker("tuning-engines-worker", {
    workflows: [governedAiWorkflow],
  });

  await worker.start();
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
`,
        "src/run.ts": `import { governedAiWorkflow } from "./workflows/tuning-engines-workflow.js";

async function main() {
  const result = await governedAiWorkflow.run({
    prompt: "Say hello from Hatchet through Tuning Engines.",
  });
  console.log(result["governed-model-call"]);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error).finally(() => process.exit(0));
}
`,
    };
}
function nodeStarterFilesWithHatchet(framework, entrypoint, entrypointPath = "src/workflow.ts") {
    return { ...nodeStarterFiles(framework, entrypoint, entrypointPath), ...hatchetExtraFiles() };
}
function restateSource() {
    return `import * as restate from "@restatedev/restate-sdk";
import { chat, emitTrace, newId, upsertStateReference } from "./tuning-engines.js";

type Input = {
  prompt?: string;
  run_id?: string;
  approval_id?: string;
};

export default restate.service({
  name: "TuningEnginesService",
  handlers: {
    async governedAi(ctx: any, input: Input) {
      const run_id = input.run_id || "restate_" + newId("run");
      const request_id = newId("req");
      const prompt = input.prompt || "Say hello from a governed Restate service.";

      await upsertStateReference({
        reference_type: "external_context",
        runtime: "restate",
        provider: "restate",
        external_id: run_id,
        run_id,
        request_id,
        status: "active",
        metadata: {
          service: "TuningEnginesService",
          handler: "governedAi",
        },
      });

      const response = await chat({
        messages: [{ role: "user", content: prompt }],
        approvalId: input.approval_id,
        metadata: {
          run_id,
          request_id,
          runtime: "restate",
          resource_type: "model",
          resource_name: "governed-model",
        },
      });

      await emitTrace({
        runId: run_id,
        name: "restate-governed-ai",
        runtime: "restate",
        status: "succeeded",
        events: [
          {
            id: newId("evt"),
            type: "workflow.step",
            status: "succeeded",
            metadata: {
              run_id,
              request_id,
              resource_type: "restate_handler",
              resource_name: "TuningEnginesService/governedAi",
            },
          },
        ],
      });

      return { run_id, response };
    },
  },
});
`;
}
function dbosSource() {
    return `import { DBOS } from "@dbos-inc/dbos-sdk";
import { chat, emitTrace, newId, upsertStateReference } from "./tuning-engines.js";

type Input = {
  prompt?: string;
  run_id?: string;
  approval_id?: string;
};

async function governedAiWorkflow(input: Input) {
  const run_id = input.run_id || newId("dbos");
  const request_id = newId("req");
  const prompt = input.prompt || "Say hello from a governed DBOS workflow.";

  await DBOS.runStep(
    async () =>
      upsertStateReference({
        reference_type: "external_context",
        runtime: "dbos",
        provider: "dbos",
        external_id: run_id,
        run_id,
        request_id,
        status: "active",
        metadata: {
          workflow_name: "governedAiWorkflow",
        },
      }),
    { name: "link-tuning-engines-state" },
  );

  const response = await DBOS.runStep(
    async () =>
      chat({
        messages: [{ role: "user", content: prompt }],
        approvalId: input.approval_id,
        metadata: {
          run_id,
          request_id,
          runtime: "dbos",
          resource_type: "model",
          resource_name: "governed-model",
        },
      }),
    { name: "governed-model-call" },
  );

  await DBOS.runStep(
    async () =>
      emitTrace({
        runId: run_id,
        name: "dbos-governed-ai",
        runtime: "dbos",
        status: "succeeded",
        events: [
          {
            id: newId("evt"),
            type: "workflow.step",
            status: "succeeded",
            metadata: {
              run_id,
              request_id,
              resource_type: "dbos_workflow",
              resource_name: "governedAiWorkflow",
            },
          },
        ],
      }),
    { name: "flush-tuning-engines-trace" },
  );

  return { run_id, response };
}

export const workflow = DBOS.registerWorkflow(governedAiWorkflow, {
  name: "tuningEnginesGovernedAi",
});
`;
}
function daprSource() {
    return `import { Task, WorkflowActivityContext, WorkflowContext, WorkflowRuntime } from "@dapr/dapr";
import { chat, emitTrace, newId, upsertStateReference } from "./tuning-engines.js";

type Input = {
  prompt?: string;
  run_id?: string;
  approval_id?: string;
};

type GovernedResult = {
  run_id: string;
  response: unknown;
};

async function governedModelActivity(_ctx: WorkflowActivityContext, input: Input): Promise<GovernedResult> {
  const run_id = input.run_id || newId("dapr");
  const request_id = newId("req");
  const prompt = input.prompt || "Say hello from a governed Dapr Workflow.";

  await upsertStateReference({
    reference_type: "external_context",
    runtime: "dapr",
    provider: "dapr",
    external_id: run_id,
    run_id,
    request_id,
    status: "active",
    metadata: {
      workflow_name: "tuning-engines-governed-ai",
      activity_name: "governedModelActivity",
    },
  });

  const response = await chat({
    messages: [{ role: "user", content: prompt }],
    approvalId: input.approval_id,
    metadata: {
      run_id,
      request_id,
      runtime: "dapr",
      resource_type: "model",
      resource_name: "governed-model",
    },
  });

  await emitTrace({
    runId: run_id,
    name: "dapr-governed-ai",
    runtime: "dapr",
    status: "succeeded",
    events: [
      {
        id: newId("evt"),
        type: "workflow.step",
        status: "succeeded",
        metadata: {
          run_id,
          request_id,
          resource_type: "dapr_activity",
          resource_name: "governedModelActivity",
        },
      },
    ],
  });

  return { run_id, response };
}

function* governedWorkflow(
  ctx: WorkflowContext,
  input: Input,
): Generator<Task<GovernedResult>, GovernedResult, GovernedResult> {
  const result: GovernedResult = yield ctx.callActivity("governedModelActivity", input) as Task<GovernedResult>;
  return result;
}

const runtime = new WorkflowRuntime();
runtime.registerWorkflowWithName("tuning-engines-governed-ai", governedWorkflow);
runtime.registerActivityWithName("governedModelActivity", governedModelActivity);

await runtime.start();
`;
}
function tuningEnginesPythonHelper() {
    return `import os
import time
import uuid
from typing import Any

import httpx


TE_API_URL = os.getenv("TE_API_URL", "https://app.tuningengines.com").rstrip("/")
TE_INFERENCE_URL = os.getenv("TE_INFERENCE_URL", "https://api.tuningengines.com/v1").rstrip("/")
TE_INFERENCE_KEY = os.getenv("TE_INFERENCE_KEY") or os.getenv("TE_API_KEY")
TE_MODEL = os.getenv("TE_MODEL", "auto")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def _headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    if not TE_INFERENCE_KEY:
        raise RuntimeError("Set TE_INFERENCE_KEY before running this starter.")
    headers = {
        "Authorization": f"Bearer {TE_INFERENCE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    headers.update(extra or {})
    return headers


def chat(prompt: str, *, run_id: str, request_id: str, runtime: str, approval_id: str | None = None) -> Any:
    headers = _headers({"X-TE-Run-ID": run_id, "X-TE-Request-ID": request_id})
    if approval_id:
        headers["X-TE-Approval-ID"] = approval_id
    response = httpx.post(
        f"{TE_INFERENCE_URL}/chat/completions",
        headers=headers,
        timeout=60,
        json={
            "model": TE_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "metadata": {
                "run_id": run_id,
                "agent_run_id": run_id,
                "request_id": request_id,
                "runtime": runtime,
                "event_type": "model.call",
            },
        },
    )
    response.raise_for_status()
    return response.json()


def emit_trace(*, run_id: str, runtime: str, name: str, status: str, events: list[dict[str, Any]]) -> Any:
    response = httpx.post(
        f"{TE_API_URL}/api/v1/traces",
        headers=_headers(),
        timeout=30,
        json={
            "run_id": run_id,
            "runtime": runtime,
            "name": name,
            "status": status,
            "events": events,
        },
    )
    response.raise_for_status()
    return response.json()


def upsert_state_reference(reference: dict[str, Any]) -> Any:
    response = httpx.post(
        f"{TE_API_URL}/api/v1/runtime_state_references",
        headers=_headers(),
        timeout=30,
        json={"runtime_state_reference": reference},
    )
    response.raise_for_status()
    return response.json()


def workflow_event(*, run_id: str, request_id: str, runtime: str, resource_type: str, resource_name: str) -> dict[str, Any]:
    return {
        "id": new_id("evt"),
        "type": "workflow.step",
        "status": "succeeded",
        "at": time.time(),
        "metadata": {
            "run_id": run_id,
            "request_id": request_id,
            "runtime": runtime,
            "resource_type": resource_type,
            "resource_name": resource_name,
        },
    }
`;
}
function prefectSource() {
    return `from prefect import flow, task

from tuning_engines_client import chat, emit_trace, new_id, upsert_state_reference, workflow_event


@task(retries=2, retry_delay_seconds=5)
def governed_model_task(prompt: str, run_id: str | None = None, approval_id: str | None = None):
    run_id = run_id or new_id("prefect")
    request_id = new_id("req")
    upsert_state_reference({
        "reference_type": "external_context",
        "runtime": "prefect",
        "provider": "prefect",
        "external_id": run_id,
        "run_id": run_id,
        "request_id": request_id,
        "status": "active",
        "metadata": {"flow": "tuning_engines_governed_ai"},
    })
    response = chat(prompt, run_id=run_id, request_id=request_id, runtime="prefect", approval_id=approval_id)
    emit_trace(
        run_id=run_id,
        runtime="prefect",
        name="prefect-governed-ai",
        status="succeeded",
        events=[workflow_event(run_id=run_id, request_id=request_id, runtime="prefect", resource_type="prefect_task", resource_name="governed_model_task")],
    )
    return {"run_id": run_id, "response": response}


@flow(name="tuning-engines-governed-ai")
def governed_ai_flow(prompt: str = "Say hello from a governed Prefect flow."):
    return governed_model_task(prompt)


if __name__ == "__main__":
    print(governed_ai_flow())
`;
}
function dagsterSource() {
    return `from dagster import Definitions, asset

from tuning_engines_client import chat, emit_trace, new_id, upsert_state_reference, workflow_event


@asset
def tuning_engines_governed_ai():
    run_id = new_id("dagster")
    request_id = new_id("req")
    upsert_state_reference({
        "reference_type": "external_context",
        "runtime": "dagster",
        "provider": "dagster",
        "external_id": run_id,
        "run_id": run_id,
        "request_id": request_id,
        "status": "active",
        "metadata": {"asset": "tuning_engines_governed_ai"},
    })
    response = chat(
        "Say hello from a governed Dagster asset.",
        run_id=run_id,
        request_id=request_id,
        runtime="dagster",
    )
    emit_trace(
        run_id=run_id,
        runtime="dagster",
        name="dagster-governed-ai",
        status="succeeded",
        events=[workflow_event(run_id=run_id, request_id=request_id, runtime="dagster", resource_type="dagster_asset", resource_name="tuning_engines_governed_ai")],
    )
    return {"run_id": run_id, "response": response}


defs = Definitions(assets=[tuning_engines_governed_ai])
`;
}
function airflowSource() {
    return `from __future__ import annotations

from datetime import datetime

from airflow.decorators import dag, task

from tuning_engines_client import chat, emit_trace, new_id, upsert_state_reference, workflow_event


@dag(
    dag_id="tuning_engines_governed_ai",
    start_date=datetime(2026, 1, 1),
    schedule=None,
    catchup=False,
    tags=["ai", "tuning-engines"],
)
def tuning_engines_governed_ai():
    @task(retries=2)
    def governed_model_call(prompt: str = "Say hello from a governed Airflow DAG."):
        run_id = new_id("airflow")
        request_id = new_id("req")
        upsert_state_reference({
            "reference_type": "external_context",
            "runtime": "airflow",
            "provider": "airflow",
            "external_id": run_id,
            "run_id": run_id,
            "request_id": request_id,
            "status": "active",
            "metadata": {"dag_id": "tuning_engines_governed_ai", "task_id": "governed_model_call"},
        })
        response = chat(prompt, run_id=run_id, request_id=request_id, runtime="airflow")
        emit_trace(
            run_id=run_id,
            runtime="airflow",
            name="airflow-governed-ai",
            status="succeeded",
            events=[workflow_event(run_id=run_id, request_id=request_id, runtime="airflow", resource_type="airflow_task", resource_name="governed_model_call")],
        )
        return {"run_id": run_id, "response": response}

    governed_model_call()


tuning_engines_governed_ai()
`;
}
//# sourceMappingURL=orchestration.js.map