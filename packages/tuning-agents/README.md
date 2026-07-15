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
- Runtime intervention polling for pause, resume, cancel, and replay
- External state references for LangGraph checkpoints, Temporal workflow IDs,
  vector namespaces, and memory records
- Usage, request capture, auditability, and token economics
- Client-side causal traces for LLM calls, MCP calls, LangGraph runs, and
  Temporal activities

For raw OpenAI-compatible clients such as OpenCode, direct Temporal Activities,
and OpenAI SDK integrations, see
[Unified API Endpoint](../../docs/unified-api-endpoint.md).

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

# Store a safe pointer to checkpoint state; no memory content is stored.
client.record_state_reference(
    reference_type="langgraph_checkpoint",
    provider="postgres",
    external_id="customer-123:checkpoint-42",
    runtime="langgraph",
)
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

Trace Explorer can also request runtime interventions. Your runtime adapter can
poll and execute them:

```python
for request in client.list_interventions(run_id=client.trace.run_id)["runtime_interventions"]:
    client.ack_intervention(request["public_id"], metadata={"worker": "langgraph"})
    # Map pause/resume/cancel/replay into your runtime here.
    client.complete_intervention(request["public_id"], metadata={"handled": True})
```

## Temporal

Temporal provides durable execution, retries, resume-after-crash, schedules, and
workflow history. The Temporal plugin registers governed activities for model
calls, skill-tool calls, MCP tools, tenant agents, approvals, traces, runtime
interventions, model catalog lookups, usage lookups, and external state
references. Temporal owns durability; Tuning Engines owns governance, policy,
usage, traces, approvals, and cost controls.

The base Temporal plugin is deliberately a primitives plugin. Its built-in
workflow is a minimal starter, not a canonical agent brain. If you need ReAct
behavior parity with the LangGraph adapter, use the separate Temporal ReAct
Streams plugin below.

```python
from temporalio.client import Client
from temporalio.worker import Worker

from tuning_agents.temporal import (
    TuningEnginesTemporalFeatures,
    chat_completion_activity,
    create_tuning_engines_plugin,
    define_temporal_workflow,
)

plugin = create_tuning_engines_plugin(
    features=TuningEnginesTemporalFeatures(
        built_in_workflow=False,
        model_calls=True,
        skill_tools=True,
        mcp_tools=True,
        agents=True,
        approvals=True,
        traces=True,
        state_references=True,
        interventions=True,
        model_catalog=True,
        usage=True,
    )
)
TuningAgentWorkflow = define_temporal_workflow()

async def main():
    temporal = await Client.connect("localhost:7233", plugins=[plugin])
    worker = Worker(
        temporal,
        task_queue="tuning-agents",
        workflows=[TuningAgentWorkflow],
    )
    await worker.run()
```

The built-in workflow accepts `AgentRunInput`. For production, prefer setting
`TE_INFERENCE_KEY`, `TE_API_URL`, `TE_INFERENCE_URL`, and `TE_MODEL` on the
worker, then pass only stable run context through workflow inputs. That keeps
provider credentials and tenant secrets out of Temporal workflow history.

Start a run with the built-in workflow:

```python
handle = await temporal.start_workflow(
    TuningAgentWorkflow.run,
    AgentRunInput(
        api_key="sk-te-...",  # or omit when TE_INFERENCE_KEY is set on the worker
        model="llama-3.3-70b-fp8",
        run_id="agent-run-001",
        messages=[{"role": "user", "content": "Check available tools and answer."}],
    ),
    id="agent-run-001",
    task_queue="tuning-agents",
)
```

If you only want part of the integration on a worker, turn off feature flags:

```python
plugin = create_tuning_engines_plugin(
    features=TuningEnginesTemporalFeatures(
        built_in_workflow=False,
        model_calls=True,
        mcp_tools=False,
        agents=False,
        traces=True,
        state_references=True,
        interventions=False,
    )
)
```

## Temporal ReAct Streams

Use `create_tuning_engines_react_streams_plugin` when you want Temporal
durability plus the same ReAct/planner semantics as the LangGraph adapter. The
workflow delegates the agent loop to `create_tuning_langgraph_agent`, so tool
selection, stop behavior, policy context, traces, and approval retries stay
aligned across LangGraph and Temporal. Temporal remains responsible for durable
workflow execution, retries, signals, history, and Workflow Streams.

```python
from temporalio.client import Client
from temporalio.worker import Worker

from tuning_agents.temporal_react_streams import (
    TemporalReactRunInput,
    create_tuning_engines_react_streams_plugin,
    define_temporal_react_streams_workflow,
)

plugin = create_tuning_engines_react_streams_plugin(include_workflow=False)
TuningReactStreamsWorkflow = define_temporal_react_streams_workflow()

async def main():
    temporal = await Client.connect("localhost:7233", plugins=[plugin])
    worker = Worker(
        temporal,
        task_queue="tuning-react-streams",
        workflows=[TuningReactStreamsWorkflow],
    )
    await worker.run()
```

Start a streamed ReAct run:

```python
handle = await temporal.start_workflow(
    TuningReactStreamsWorkflow.run,
    TemporalReactRunInput(
        api_key="sk-te-...",  # or set TE_INFERENCE_KEY on the worker
        model="llama-3.3-70b-fp8",
        run_id="agent-run-001",
        request_id="req-001",
        thread_id="customer-123",
        messages=[{"role": "user", "content": "Use governed tools to answer."}],
        server_names=["github"],
        agent_names=["billing-escalation"],
    ),
    id="agent-run-001",
    task_queue="tuning-react-streams",
)
```

The workflow publishes live events to the `tuning_events` Workflow Stream:

- `workflow.started`
- `react.agent.started`
- `react.agent.completed`
- `react.agent.failed`
- `workflow.completed`
- `workflow.failed`

Callers can subscribe to that stream using Temporal's Workflow Streams APIs.
Activities publish progress with `WorkflowStreamClient.from_within_activity()`
when the SDK preview API is available; otherwise streaming degrades to a no-op
while the workflow still runs normally. The workflow also exposes
`subscriber_acknowledged_terminator`; subscribers can signal it after reading a
terminal event so the workflow can return immediately instead of waiting for the
short safety timeout.

## Trace Semantics

This SDK captures the full client/runtime-side causal trace:

- LangGraph agent creation/invocation
- LLM calls
- MCP tool discovery and execution
- A2A agent dispatches
- Temporal workflow activities
- Runtime interventions
- External state/memory references
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

State and intervention helpers use the same auth. Inference keys can upsert
state references and poll/ack/complete interventions for their tenant when a
`run_id` is provided.

## Why this exists

The Rails app stays the control plane. This package gives customers a portable
runtime layer:

- LangGraph for agent loops, state, memory, interrupts, and checkpoints
- Temporal for crash-proof durable execution
- Tuning Engines for governance, registries, agents, skills, MCP, routing, usage, and economics
