import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

type Framework = "langgraph" | "temporal";

export function registerOrchestrationCommands(program: Command): void {
  const orchestration = program
    .command("orchestration")
    .description("Create LangGraph or Temporal starter kits wired to Tuning Engines");

  orchestration
    .command("init <framework>")
    .description("Create a governed orchestration starter kit: langgraph or temporal")
    .option("--dir <path>", "Output directory")
    .option("--force", "Overwrite existing files")
    .action((framework: string, opts) => {
      const normalized = framework.toLowerCase() as Framework;
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

function writeTemplate(targetDir: string, framework: Framework, force: boolean): void {
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

function sharedReadme(framework: Framework): string {
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
`;
}

function langgraphFiles(): Record<string, string> {
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
        governed_model_call()
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

function temporalFiles(): Record<string, string> {
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

function envExample(): string {
  return `TE_API_KEY=sk-te-your-inference-key
TE_API_URL=https://app.tuningengines.com
TE_INFERENCE_URL=https://api.tuningengines.com/v1
TE_MODEL=auto
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_TASK_QUEUE=tuning-engines-demo
`;
}
