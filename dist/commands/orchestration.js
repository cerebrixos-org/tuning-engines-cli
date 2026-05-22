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
function registerOrchestrationCommands(program) {
    const orchestration = program
        .command("orchestration")
        .description("Create LangGraph or Temporal starter kits wired to Tuning Engines");
    orchestration
        .command("init <framework>")
        .description("Create a governed orchestration starter kit: langgraph or temporal")
        .option("--dir <path>", "Output directory")
        .option("--force", "Overwrite existing files")
        .action((framework, opts) => {
        const normalized = framework.toLowerCase();
        if (normalized !== "langgraph" && normalized !== "temporal") {
            console.error("framework must be one of: langgraph, temporal");
            process.exit(1);
        }
        const targetDir = path.resolve(opts.dir || `tuning-engines-${normalized}`);
        writeTemplate(targetDir, normalized, Boolean(opts.force));
        console.log(`Created ${normalized} starter kit at ${targetDir}`);
        console.log("Set TE_API_KEY, then follow the README in that directory.");
    });
}
function writeTemplate(targetDir, framework, force) {
    fs.mkdirSync(targetDir, { recursive: true });
    const files = framework === "langgraph" ? langgraphFiles() : temporalFiles();
    for (const [name, content] of Object.entries(files)) {
        const filePath = path.join(targetDir, name);
        if (fs.existsSync(filePath) && !force) {
            throw new Error(`${filePath} already exists. Re-run with --force to overwrite.`);
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, "utf8");
    }
}
function sharedReadme(framework) {
    return `# Tuning Engines ${framework} starter

This starter keeps ${framework} in charge of orchestration state while Tuning Engines governs model, MCP, agent, and skill access.

## Configure

\`\`\`bash
cp .env.example .env
export TE_API_KEY=sk-te-your-inference-key
export TE_MODEL=auto
\`\`\`

Use a user API token \`te_...\` for CLI/admin actions such as \`te approvals list\` and \`te traces show\`.
Use an inference key \`sk-te-...\` for model, MCP, agent, skill, and trace-ingest calls.

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
- normalized event \`type\`: for example \`model.call\`, \`mcp.tool_call\`, \`agent.message\`, \`workflow.step\`, \`human.edit\`, \`action.finalized\`, or \`outcome.recorded\`.

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
        ".env.example": envExample(),
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


def retry_after_approval(callable_, approval_id: str):
    return callable_(approval_id=approval_id)


def main() -> None:
    client = TuningClient(
        api_key=os.environ["TE_API_KEY"],
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
        ".env.example": envExample(),
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
        api_key=os.environ["TE_API_KEY"],
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
    except TuningError as exc:
        client.flush_trace(name="temporal-governed-demo", runtime="temporal", status="failed")
        raise


@activity.defn
async def mcp_tool_activity(server_name: str, tool_name: str, arguments: dict) -> dict:
    client = TuningClient(api_key=os.environ["TE_API_KEY"])
    return await client.acall_mcp_tool(server_name=server_name, tool_name=tool_name, arguments=arguments)


@activity.defn
async def agent_activity(agent_name: str, message: str) -> dict:
    client = TuningClient(api_key=os.environ["TE_API_KEY"])
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
function envExample() {
    return `TE_API_KEY=sk-te-your-inference-key
TE_API_URL=https://app.tuningengines.com
TE_INFERENCE_URL=https://api.tuningengines.com/v1
TE_MODEL=auto
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_TASK_QUEUE=tuning-engines-demo
`;
}
//# sourceMappingURL=orchestration.js.map