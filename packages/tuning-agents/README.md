# tuning-agents

Governed agent runtime adapters for Tuning Engines.

This package keeps orchestration outside Rails while making agent runtimes use
Tuning Engines for the things it already does well:

- OpenAI-compatible model access through the inference gateway
- MCP tool discovery and execution through `/v1/mcp/tools*`
- A2A tenant-agent dispatch through `/v1/agents/{name}/message`
- Agent/skill OpenAI tool specs that line up with proxy RBAC and AGT policy
- Registry/RBAC/governance enforcement at the gateway
- AGT shadow-mode policy decisions and human approval retries
- Usage, request capture, auditability, and token economics
- Client-side causal traces for LLM calls, MCP calls, LangGraph runs, and
  Temporal activities

## Install

```bash
pip install tuning-agents[langgraph]
pip install tuning-agents[temporal]
```

From this repository:

```bash
pip install -e packages/tuning-agents[langgraph,temporal]
```

## LangGraph

LangGraph provides the actual agent loop, checkpoints, memory, interrupts, and
human-in-the-loop workflow. Tuning Engines remains the governed model/tool
gateway.

```python
from langgraph.checkpoint.memory import InMemorySaver

from tuning_agents import TuningClient
from tuning_agents.langgraph import create_tuning_langgraph_agent, invoke_with_trace

client = TuningClient(api_key="sk-te-...", inference_url="https://api.tuningengines.com/v1")

agent = create_tuning_langgraph_agent(
    client,
    model="llama-3.3-70b-fp8",
    agent_names=["billing-escalation"],
    checkpointer=InMemorySaver(),
    interrupt_before=["tools"],  # optional approval gate before tool execution
)

result = invoke_with_trace(
    client,
    agent,
    [{"role": "user", "content": "Use the registry tools to summarize my latest jobs."}],
    thread_id="customer-123",
)

print(result)
print(client.trace.as_dict())

# Store the runtime trace in Tuning Engines.
client.flush_trace(name="ticket-triage", runtime="langgraph", status="succeeded")
```

The LangGraph adapter exposes two executable resource classes:

- MCP tools discovered from the Tuning Engines proxy
- Registered tenant agents passed via `agent_names`, executed through
  `/v1/agents/{name}/message`

Skills are different: they are governed prompt/workflow bundles represented as
OpenAI tool specs. Use `ResourceManifest.openai_tools()` when you want the proxy
to enforce skill access on a direct chat-completions call.

```python
from tuning_agents.resources import ResourceManifest

manifest = ResourceManifest(
    model="llama-3.3-70b-fp8",
    agents={"billing-escalation": "Escalate complex billing issues."},
    skills={"analytics": "Run the tenant analytics skill."},
)

resp = client.chat(
    model=manifest.model,
    messages=[{"role": "user", "content": "Analyze this ticket and escalate if needed."}],
    tools=manifest.openai_tools(),
)
```

If a policy returns `needs_approval`, approve it in the Tuning Engines UI or
with `te approvals approve <id>`, then retry with the approval id:

```python
resp = client.chat(
    model=manifest.model,
    messages=[{"role": "user", "content": "Run the governed action again."}],
    tools=manifest.openai_tools(),
    approval_id="apr_...",
)
```

## Temporal

Temporal provides durable execution, retries, resume-after-crash, schedules, and
workflow history. The provided workflow is intentionally small: each LLM turn and
MCP tool call runs as an activity, so Temporal owns durability and Tuning Engines
owns model/tool governance.

```python
from temporalio.client import Client
from temporalio.worker import Worker

from tuning_agents.temporal import (
    AgentRunInput,
    agent_message_activity,
    chat_completion_activity,
    define_temporal_workflow,
    mcp_tool_activity,
)

TuningAgentWorkflow = define_temporal_workflow()

async def main():
    temporal = await Client.connect("localhost:7233")
    worker = Worker(
        temporal,
        task_queue="tuning-agents",
        workflows=[TuningAgentWorkflow],
        activities=[chat_completion_activity, mcp_tool_activity, agent_message_activity],
    )
    await worker.run()
```

Start a run:

```python
handle = await temporal.start_workflow(
    TuningAgentWorkflow.run,
    AgentRunInput(
        api_key="sk-te-...",
        model="llama-3.3-70b-fp8",
        messages=[{"role": "user", "content": "Check available tools and answer."}],
    ),
    id="agent-run-001",
    task_queue="tuning-agents",
)
```

## Trace Semantics

This SDK captures the full client/runtime-side causal trace:

- LangGraph agent creation/invocation
- LLM calls
- MCP tool discovery and execution
- A2A agent dispatches
- Temporal workflow activities
- Errors and latency metadata

Events are normalized to Tuning Engines' shared taxonomy where possible:
`model.call`, `model.embedding`, `mcp.tool_call`, `skill.invoke`,
`agent.message`, `workflow.step`, `policy.decision`, approval lifecycle events,
`human.edit`, `action.finalized`, and `outcome.recorded`. Every SDK event also
gets a `run_id` and `request_id`.

To capture the compounding-loop signal, add redacted decision metadata:

```python
event_id = client.trace.start(
    "agent.message",
    {
        "decision": client.trace.decision(
            proposal_summary="Agent proposed updating the fallback rule.",
            changed_fields=["fallback_model"],
        )
    },
)
client.trace.finish(
    event_id,
    {
        "decision": client.trace.decision(
            final_action="update_routing_profile",
            outcome_label="success",
        )
    },
)
```

Do not store raw prompts, provider keys, tenant secrets, or full customer data
in trace metadata. Request capture for fine-tuning is a separate explicit
opt-in path.

Rails/proxy already capture the gateway side: inference usage, request capture,
audit logs, policy decisions, approval requests, token counts, and billing
attribution. The SDK captures the runtime side and can persist it with:

```python
client.flush_trace(name="support-agent", runtime="langgraph", status="succeeded")
```

That sends events to `POST /api/v1/traces` using the same `TE_API_KEY` auth as
the CLI/MCP server.

## Why this exists

The Rails app stays the control plane. This package gives customers a portable
runtime layer:

- LangGraph for agent loops, state, memory, interrupts, and checkpoints
- Temporal for crash-proof durable execution
- Tuning Engines for governance, registries, agents, skills, MCP, routing, usage, and economics
