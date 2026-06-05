# Tuning Engines CLI & MCP Server

[![tuning-engines-cli MCP server](https://glama.ai/mcp/servers/cerebrixos-org/tuning-engines-cli/badges/card.svg)](https://glama.ai/mcp/servers/cerebrixos-org/tuning-engines-cli)

[![npm version](https://img.shields.io/npm/v/tuningengines-cli.svg)](https://www.npmjs.com/package/tuningengines-cli)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-tuning--engines-blue)](https://registry.modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Govern every AI workflow through one API.

**[Tuning Engines](https://tuningengines.com)** is a governed AI runtime for model, agent, skill, and MCP workflows. Route inference through one OpenAI-compatible API, apply RBAC and traffic policies, request approvals for high-risk actions, inspect traces and usage, and connect durable orchestration frameworks such as LangGraph and Temporal. The same CLI and MCP server also manage domain-specific fine-tuning of open-source models.

## Training Agents

Tuning Engines uses specialized **agents** that control how your data is analyzed and converted into training data. Each agent produces a different kind of domain-specific fine-tuned model optimized for its use case. Current agents focus on code, with more coming for customer support, data extraction, security review, ops, and other domains.

### Cody (`code_repo`) — Code Autocomplete Agent

Cody fine-tunes on your GitHub repo using QLoRA (4-bit quantized LoRA) via the Axolotl framework (HuggingFace Transformers + PEFT). It learns your codebase's patterns, naming conventions, and project structure to produce a fast, lightweight adapter optimized for real-time completions.

**Best for:** code autocomplete, inline suggestions, tab-complete, code style matching, pattern completion.

```bash
te jobs create --agent code_repo \
  --base-model Qwen/Qwen2.5-Coder-7B-Instruct \
  --repo-url https://github.com/your-org/your-repo \
  --output-name my-cody-model
```

### SIERA (`sera_code_repo`) — Bug-Fix Specialist

SIERA (Synthetic Intelligent Error Resolution Agent) uses the Open Coding Agents approach from AllenAI to generate targeted bug-fix training data from your repository. It synthesizes realistic error scenarios and their resolutions, then fine-tunes a model that learns your team's debugging style, error handling conventions, and fix patterns.

**Best for:** debugging, error resolution, patch generation, root cause analysis, fix suggestions.

```bash
te jobs create --agent sera_code_repo \
  --quality-tier high \
  --base-model Qwen/Qwen2.5-Coder-7B-Instruct \
  --repo-url https://github.com/your-org/your-repo \
  --output-name my-siera-model
```

**Quality tiers (SIERA only):**
- `low` — Faster, fewer synthetic pairs (default)
- `high` — Deeper analysis, more training data, better results

### Coming Soon

| Agent | Persona | What it does |
|-------|---------|-------------|
| **Resolve** | Mira | Fine-tunes on support tickets, macros, and KB articles for automated ticket resolution |
| **Extractor** | Flux | Trains for strict schema extraction from docs, PDFs, and business text |
| **Guard** | Aegis | Security-focused code reviewer that catches risky patterns and proposes safer fixes |
| **OpsPilot** | Atlas | Incident response agent trained on runbooks, postmortems, and on-call notes |

## Supported Base Models

| Size | Models |
|------|--------|
| **3B** | `Qwen/Qwen2.5-Coder-3B-Instruct` |
| **7B** | `codellama/CodeLlama-7b-hf`, `deepseek-ai/deepseek-coder-7b-instruct-v1.5`, `Qwen/Qwen2.5-Coder-7B-Instruct` |
| **13-15B** | `codellama/CodeLlama-13b-Instruct-hf`, `bigcode/starcoder2-15b`, `Qwen/Qwen2.5-Coder-14B-Instruct` |
| **32-34B** | `deepseek-ai/deepseek-coder-33b-instruct`, `codellama/CodeLlama-34b-Instruct-hf`, `Qwen/Qwen2.5-Coder-32B-Instruct` |
| **70-72B** | `codellama/CodeLlama-70b-Instruct-hf`, `meta-llama/Llama-3.1-70B-Instruct`, `Qwen/Qwen2.5-72B-Instruct` |

## Quick Start

```bash
npm install -g tuningengines-cli

# Or run without installing
npx -y --package tuningengines-cli@latest te auth status

# Sign up or log in (opens browser — works for new accounts too)
te auth login

# Add credits (opens browser to billing page)
te billing add-credits

# Estimate cost before training
te jobs estimate --base-model Qwen/Qwen2.5-Coder-7B-Instruct

# Train Cody on your repo
te jobs create --agent code_repo \
  --base-model Qwen/Qwen2.5-Coder-7B-Instruct \
  --repo-url https://github.com/your-org/your-repo \
  --output-name my-model

# Monitor training
te jobs status <job-id> --watch

# View your trained models
te models list

# Create a governed orchestration starter
te orchestration init langgraph
te orchestration init temporal
te orchestration init inngest
te orchestration init triggerdev
te orchestration init hatchet
te orchestration init restate
te orchestration init dbos
te orchestration init dapr
te orchestration init prefect
te orchestration init dagster
te orchestration init airflow
```

## MCP Server Setup

The CLI includes a built-in MCP server with 60+ tools. Any AI assistant that supports MCP can fine-tune models, manage training jobs, run evaluations, check inference usage, inspect traces, review approvals, and manage non-secret tenant registry metadata through natural language.

For security, the MCP server intentionally does not expose internal proxy routes. It also refuses MCP-side inference-key creation and raw secret-bearing mutation fields. Use the CLI or web UI for workflows that intentionally create one-time keys, submit raw provider secrets, validate S3 credentials, or import/export S3 assets with raw credentials.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tuning-engines": {
      "command": "npx",
      "args": ["-y", "--package", "tuningengines-cli@latest", "te", "mcp", "serve"],
      "env": {
        "TE_API_KEY": "te_your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add tuning-engines -- npx -y --package tuningengines-cli@latest te mcp serve
```

### Work Sessions and outcomes

Label the desired outcome for a project without interrupting your coding workflow:

```bash
te goal start "Fix flaky checkout retries"
te goal show
te goal complete --result succeeded
```

Install optional native telemetry hooks for Claude Code or Codex:

```bash
te guard claude-code install --mode observe --project .
te guard claude-code doctor
te guard claude-code doctor --probe
te guard codex install
```

Claude Code writes project-local hooks into `.claude/settings.local.json`. On
Windows, verify with `dir .\.claude`, `type .\.claude\settings.local.json`,
then restart Claude Code from the same project root and review `claude /hooks`.
`doctor --probe` is available in `tuningengines-cli` 0.4.20 and later; it runs
synthetic hook events through the installed commands and checks that the trace is
visible to Tuning Engines. Hook invocations also write a local redacted status
log at `.claude/tuning-engines-hook-status.jsonl`.
Codex project hooks require review and trust from `/hooks`. Tuning Engines sends
pseudonymous session and transcript references by default, not transcript
contents or local absolute paths.

### Claude Code Plugin

The repository also ships a Claude Code plugin wrapper around the same MCP
server. It keeps installation discoverable while preserving the same
`TE_API_KEY` environment-variable boundary:

```bash
claude plugin marketplace add cerebrixos-org/tuning-engines-cli
claude plugin install tuning-engines@tuning-engines
```

### VS Code / Cursor / Windsurf

Add to your MCP settings (`.vscode/mcp.json` or equivalent):

```json
{
  "servers": {
    "tuning-engines": {
      "command": "npx",
      "args": ["-y", "--package", "tuningengines-cli@latest", "te", "mcp", "serve"],
      "env": {
        "TE_API_KEY": "te_your_key_here"
      }
    }
  }
}
```

### What the AI assistant can do

When connected, your AI assistant can:

- "Fine-tune Qwen 7B on my-org/my-repo using the SIERA agent with high quality"
- "How much would it cost to train a 32B model for 3 epochs on this repo?"
- "Check the status of my latest training job"
- "List my trained models"
- "Export my model to s3://my-bucket/models/"
- "Show my account balance"
- "Train a bug-fix specialist on this repo" (auto-selects SIERA)
- "Create an autocomplete model for this codebase" (auto-selects Cody)

The `create_job` tool description includes full agent details and model lists, so AI assistants automatically select the right agent and model based on what you ask for.

## Unified API Endpoint

Tuning Engines can be used anywhere a tool accepts an OpenAI-compatible API
base URL. Point the client at:

```text
https://api.tuningengines.com/v1
```

Use an inference key that starts with `sk-te-...` for live model calls, and use
the model IDs shown by:

```bash
te inference models
```

This lets OpenCode, Temporal activities, LangGraph apps, OpenAI SDK clients,
and other custom-provider clients route through the same Tuning Engines control
plane for model RBAC, routing, fallbacks, guardrails, AGT policy, traces,
usage metering, and cost attribution.

See [docs/unified-api-endpoint.md](docs/unified-api-endpoint.md) for copy-paste
examples for OpenCode, Temporal, Python, JavaScript, and other
OpenAI-compatible clients.

## Agent Runtime SDK and Orchestration Starters

Use the CLI/MCP package when you want `npx` tools for assistants. Use the
Python SDK when you want your own app to run durable agent workflows while
Tuning Engines remains the governed control plane for models, agents, skills,
MCP tools, RBAC, AGT policy, audit, usage, and token economics.

Install directly from this repo:

```bash
pip install "tuning-agents[langgraph] @ git+https://github.com/cerebrixos-org/tuning-engines-cli.git#subdirectory=packages/tuning-agents"
pip install "tuning-agents[temporal] @ git+https://github.com/cerebrixos-org/tuning-engines-cli.git#subdirectory=packages/tuning-agents"
```

LangGraph example:

```python
from langgraph.checkpoint.memory import InMemorySaver

from tuning_agents import TuningClient
from tuning_agents.langgraph import create_tuning_langgraph_agent, invoke_with_trace

client = TuningClient(api_key="te_your_key_here")

agent = create_tuning_langgraph_agent(
    client,
    model="llama-3.3-70b-fp8",
    agent_names=["billing-escalation"],
    checkpointer=InMemorySaver(),
    interrupt_before=["tools"],
)

result = invoke_with_trace(
    client,
    agent,
    [{"role": "user", "content": "Triage this ticket and escalate if needed."}],
    thread_id="ticket-123",
)

client.flush_trace(name="ticket-triage", runtime="langgraph", status="succeeded")
```

Temporal example:

```python
from tuning_agents.temporal import (
    agent_message_activity,
    chat_completion_activity,
    define_temporal_workflow,
    mcp_tool_activity,
)

TuningAgentWorkflow = define_temporal_workflow()
# Register TuningAgentWorkflow plus the three activities in your Temporal worker.
```

The SDK captures runtime events from LangGraph/Temporal and posts them to
`POST /api/v1/traces`. Each event carries a `run_id`, `request_id`, and a
normalized event type such as `model.call`, `mcp.tool_call`, `agent.message`,
`workflow.step`, `human.edit`, `action.finalized`, `outcome.recorded`, or
`state.reference`. The app pairs that with inference usage, request capture,
policy decisions, approval requests, external state references, audit, and
billing logs.

JavaScript/TypeScript users can also import lightweight tracing helpers from
the npm package:

```ts
import { createOpenAIAgentsTraceAdapter } from "tuningengines-cli/adapters/openai-agents";
import { createClaudeAgentSdkTraceAdapter } from "tuningengines-cli/adapters/claude-agent-sdk";
```

Both helpers send redacted run, model, tool, handoff, error, goal, and outcome
events to the existing trace API. `goal_key`, `goal_status`, and `goal_score`
are normalized into the same success-signal analytics as `outcome_key`.

For decision traces, store redacted signals in `metadata.decision`, for example
`proposal_summary`, `changed_fields`, `change_summary`, `final_action`,
`outcome_label`, and `reason_summary`. Do not place raw prompts, provider keys,
tenant secrets, or full customer data in trace metadata.

Generate a starter kit:

```bash
te orchestration init langgraph --dir ./lg-te-demo
te orchestration init temporal --dir ./temporal-te-demo
te orchestration init inngest --dir ./inngest-te-demo
te orchestration init triggerdev --dir ./trigger-te-demo
te orchestration init hatchet --dir ./hatchet-te-demo
te orchestration init restate --dir ./restate-te-demo
te orchestration init dbos --dir ./dbos-te-demo
te orchestration init dapr --dir ./dapr-te-demo
te orchestration init prefect --dir ./prefect-te-demo
te orchestration init dagster --dir ./dagster-te-demo
te orchestration init airflow --dir ./airflow-te-demo
```

LangGraph and Temporal starters use the Python runtime SDK. Inngest,
Trigger.dev, and Hatchet starters generate TypeScript projects with a small
self-contained Tuning Engines helper. Restate, DBOS, and Dapr starters use the
same TypeScript helper. Prefect, Dagster, and Airflow starters generate Python
workflow examples with a small helper module. All generated examples include
governed model calls, trace flushing, registry manifests, policy context
metadata, decision metadata, runtime state references, and approval retry
patterns.

## CLI Commands

### Authentication

| Command | Description |
|---------|-------------|
| `te auth login` | Sign up or log in via browser |
| `te auth logout` | Clear saved credentials |
| `te auth status` | Show current auth status (email, balance) |

### Training Jobs

| Command | Description |
|---------|-------------|
| `te jobs list` | List all training jobs |
| `te jobs show <id>` | Show job details |
| `te jobs create` | Submit a training job (`--agent`, `--quality-tier`, `--base-model`, `--repo-url`, `--output-name`) |
| `te jobs status <id>` | Live status (`--watch` for continuous polling) |
| `te jobs cancel <id>` | Cancel a running job |
| `te jobs retry <id>` | Retry from last checkpoint |
| `te jobs estimate` | Cost estimate before submitting |
| `te jobs validate-s3` | Pre-validate S3 credentials |

### Models

| Command | Description |
|---------|-------------|
| `te models list` | List your trained models |
| `te models show <id>` | Show model details |
| `te models base` | List supported base models |
| `te models import` | Import a model from S3 |
| `te models export <id>` | Export a model to S3 |
| `te models delete <id>` | Delete a model |
| `te models status <id>` | Check import/export status |

### Datasets

| Command | Description |
|---------|-------------|
| `te datasets list` | List all datasets |
| `te datasets show <id>` | Show dataset details |
| `te datasets create` | Create a dataset from S3 (`--name`, `--s3-url`, `--for-evaluation`) |
| `te datasets delete <id>` | Delete a dataset |
| `te datasets status <id>` | Check import/processing status |

### Evaluations

| Command | Description |
|---------|-------------|
| `te evals list` | List all evaluations |
| `te evals show <id>` | Show evaluation details and scores |
| `te evals create` | Run an evaluation (`--model`, `--dataset`, `--evaluators`) |
| `te evals cancel <id>` | Cancel a running evaluation |
| `te evals status <id>` | Live evaluation progress |
| `te evals evaluators` | List available evaluators |
| `te evals estimate` | Cost estimate for an evaluation |

### Inference

| Command | Description |
|---------|-------------|
| `te inference models` | List available inference models |
| `te inference usage` | Show inference API usage stats |
| `te inference jwt` | Get a JWT for direct API access |
| `te inference token` | Exchange an inference key (`sk-te-...`) for a short-lived inference JWT |

### Runtime Traces and Approvals

| Command | Description |
|---------|-------------|
| `te traces list` | List LangGraph, Temporal, and custom runtime traces |
| `te traces show <run-id>` | Show one trace, including events, policy decisions, and approvals when linked |
| `te traces ingest --data '<json>'` | Ingest or update a trace using a user API token or inference key |
| `te outcomes list` | List observed outcomes, goals, evals, and workflow success signals |
| `te outcomes record --run-id ... --key ... --label ...` | Record a success signal for a run |
| `te outcomes map --outcome-key ... --criteria '<json>'` | Map unmapped events to an outcome key |
| `te insights list` | List Insight Loop recommendations |
| `te insights accept <id>` | Accept an insight as valid; does not change production |
| `te insights apply <id>` | Apply or queue the approved action for an accepted insight |
| `te doctor simulate --data '<json>'` | Simulate inference access, role, endpoint, policy, and resource checks |
| `te policy-decisions list` | List AGT YAML policy decisions |
| `te policy-decisions show <id>` | Show one policy decision with redacted context |
| `te policy-templates list` | List curated AGT YAML policy templates |
| `te policy-templates render <id> --params '<json>'` | Render disabled/shadow policy YAML from safe structured parameters |
| `te policy-drafts generate --prompt '<text>'` | Generate an AI-assisted disabled/shadow draft for review and testing |
| `te approvals list --status pending` | List policy approval requests |
| `te approvals show <id>` | Show approval detail and retry metadata |
| `te approvals approve <id>` | Approve a pending request |
| `te approvals deny <id>` | Deny a pending request |

### Orchestration Starters

| Command | Description |
|---------|-------------|
| `te orchestration init langgraph` | Create a LangGraph starter wired to Tuning Engines governance and traces |
| `te orchestration init temporal` | Create a Temporal worker starter wired to Tuning Engines governance and traces |
| `te orchestration init inngest` | Create an Inngest function starter wired to Tuning Engines governance and traces |
| `te orchestration init triggerdev` | Create a Trigger.dev task starter wired to Tuning Engines governance and traces |
| `te orchestration init hatchet` | Create a Hatchet workflow starter wired to Tuning Engines governance and traces |
| `te orchestration init restate` | Create a Restate service starter wired to Tuning Engines governance and traces |
| `te orchestration init dbos` | Create a DBOS workflow starter wired to Tuning Engines governance and traces |
| `te orchestration init dapr` | Create a Dapr Workflow starter wired to Tuning Engines governance and traces |
| `te orchestration init prefect` | Create a Prefect flow starter wired to Tuning Engines governance and traces |
| `te orchestration init dagster` | Create a Dagster asset starter wired to Tuning Engines governance and traces |
| `te orchestration init airflow` | Create an Airflow DAG starter wired to Tuning Engines governance and traces |

### Agents

| Command | Description |
|---------|-------------|
| `te agents list` | List available agents |
| `te agents show <id>` | Show agent details and capabilities |

### Tenant Admin Automation

These commands require an API token for a tenant owner or tenant admin. They are
designed for CI smoke tests and end-to-end product checks. Secret fields can be
sent on create/update where the server supports them, but responses never print
stored provider keys, AWS secrets, or invitation tokens.

| Command | Description |
|---------|-------------|
| `te tenant resources` | List supported tenant resource names |
| `te tenant list <resource>` | List resources such as `inference_keys`, `inference_roles`, `model_deployments`, `routing_profiles`, `guardrail_policies`, `governance_policies`, `mcp_servers`, `tenant_agents`, `tenant_skills`, and `credential_sources` |
| `te tenant show <resource> <id>` | Show one tenant resource |
| `te tenant create <resource> --data '<json>'` | Create a tenant resource from JSON |
| `te tenant update <resource> <id> --data '<json>'` | Update a tenant resource from JSON |
| `te tenant delete <resource> <id>` | Delete a tenant resource; inference keys are revoked |
| `te tenant validate guardrail_policies --data '<json>' --sample-text 'hello'` | Validate/test an unsaved simple guardrail without creating records |
| `te tenant validate governance_policies --data '<json>' --context '<json>'` | Validate/test an unsaved Governance Rule without creating records |
| `te tenant test-policy <id> --context '<json>'` | Dry-run a Governance Rule |
| `te tenant test governance_policies <id> --context '<json>'` | Compatibility alias for governance policy dry-runs |
| `te tenant team list` | List tenant members, pending invitations, and allowed domains |
| `te tenant team invite <email> --role member` | Invite a user by email; the invite token is emailed and never printed |
| `te tenant team set-role <member-id> --inference-role-id <id>` | Assign an inference role to a member |
| `te tenant team disable <member-id>` | Disable a member |
| `te tenant team enable <member-id>` | Re-enable a member |
| `te tenant team remove <member-id>` | Remove a member |
| `te tenant team cancel-invite <invitation-id>` | Cancel a pending invitation |
| `te tenant team domains --set "example.com,example.org"` | Replace allowed email domains |
| `te tenant capture show` | Show inference capture settings |
| `te tenant capture update --data '<json>'` | Update inference capture settings |

### Billing & Account

| Command | Description |
|---------|-------------|
| `te billing show` | Balance and transaction history |
| `te billing add-credits` | Open browser to add credits |
| `te account` | Account info |

### Configuration

| Command | Description |
|---------|-------------|
| `te config set-token <key>` | Set API key manually |
| `te config set-url <url>` | Override API URL |
| `te config show` | Show current config |

All commands support `--json` for machine-readable output.

## MCP Tools Reference

### Training Jobs

| Tool | Description |
|------|-------------|
| `create_job` | Fine-tune an LLM on a GitHub repo. Supports agent selection (Cody, SIERA), quality tier, base model, epochs, S3 export. |
| `estimate_job` | Cost estimate before training. Returns cost range, balance, sufficiency check. |
| `list_jobs` | List training jobs with status filter |
| `show_job` | Full job details including agent, model, GPU usage, cost, retry info |
| `job_status` | Live status with GPU minutes, charges, delivery progress |
| `cancel_job` | Cancel a running/queued job |
| `retry_job` | Retry a failed job from its last checkpoint |

### Models

| Tool | Description |
|------|-------------|
| `list_models` | List trained and imported models |
| `show_model` | Model details (status, size, base model, training job) |
| `delete_model` | Delete a model from cloud storage |
| `model_status` | Import/export progress |
| `list_supported_models` | Available base models with GPU hours per epoch |

### Marketplace

| Tool | Description |
|------|-------------|
| `list_catalog_models` | Browse pre-built models and datasets |
| `get_catalog_model` | Details of a marketplace item |
| `catalog_export_status` | Check marketplace export progress |

### Datasets

| Tool | Description |
|------|-------------|
| `list_datasets` | List datasets for training and evaluation |
| `show_dataset` | Dataset details and status |
| `create_dataset` | Create a dataset from S3 |
| `delete_dataset` | Delete a dataset |
| `dataset_status` | Check dataset import/processing status |

### Evaluations

| Tool | Description |
|------|-------------|
| `list_evaluations` | List model evaluations |
| `show_evaluation` | Evaluation details, scores, and metrics |
| `create_evaluation` | Run an evaluation against a dataset |
| `cancel_evaluation` | Cancel a running evaluation |
| `evaluation_status` | Live evaluation progress |
| `list_evaluators` | Available evaluators (code_execution, similarity, llm_judge, etc.) |
| `estimate_evaluation` | Cost estimate for an evaluation |

### Inference

| Tool | Description |
|------|-------------|
| `list_inference_models` | Models available for inference |
| `inference_usage` | Inference API usage statistics |
| `get_inference_jwt` | Get JWT token for direct API access |
| `get_inference_token` | Exchange an inference key for a short-lived inference JWT |

### Runtime, Policy, and Approvals

| Tool | Description |
|------|-------------|
| `list_traces` | List runtime traces |
| `show_trace` | Show a trace with linked events, policy decisions, and approvals |
| `create_trace` | Ingest a trace payload without secrets |
| `list_outcomes` | List observed outcomes/goals normalized as success signals |
| `list_insights` | List Insight Loop recommendations |
| `show_insight` | Show one Insight Loop recommendation |
| `doctor_simulate` | Simulate inference access, role, endpoint, policy, and resource checks |
| `record_outcome` | Record an outcome/goal signal; requires `--enable-registry-writes` |
| `map_outcome` | Create an outcome mapping rule; requires `--enable-registry-writes` |
| `accept_insight` | Accept an insight for review; requires `--enable-registry-writes` |
| `apply_insight` | Apply or queue an accepted insight; requires `--enable-registry-writes` |
| `list_policy_decisions` | List AGT YAML policy decisions |
| `show_policy_decision` | Show one decision with redacted context |
| `list_policy_templates` | List curated AGT YAML policy templates |
| `render_policy_template` | Render disabled/shadow policy YAML from safe structured parameters |
| `generate_policy_draft` | Generate an AI-assisted disabled/shadow draft; secret-looking prompts are refused |
| `list_approvals` | List policy approval requests |
| `show_approval` | Show one approval request |
| `approve_approval` | Approve a pending request |
| `deny_approval` | Deny a pending request |

### Tenant Admin MCP Tools

These tools require a tenant owner/admin API token. The MCP server refuses internal
proxy routes, inference-key creation, and raw secret-bearing mutation fields.

| Tool | Description |
|------|-------------|
| `list_tenant_resources` | List allowlisted tenant resource names |
| `tenant_resource_list` | List models, roles, policies, MCP servers, agents, skills, credential sources, and related metadata |
| `tenant_resource_show` | Show one resource without returning stored secrets |
| `tenant_resource_create` | Create non-secret tenant registry/config metadata |
| `tenant_resource_update` | Update non-secret tenant registry/config metadata |
| `tenant_resource_delete` | Delete or revoke a tenant resource |
| `tenant_resource_validate` | Validate/test unsaved guardrail or AGT policy payloads without creating records |
| `test_governance_policy` | Dry-run an AGT YAML governance policy |
| `tenant_team_list` | List members, invitations, and allowed domains |
| `tenant_team_invite` | Invite a user without returning invitation tokens |
| `tenant_team_set_inference_role` | Assign or clear an inference role |
| `tenant_team_disable` / `tenant_team_enable` | Disable or re-enable a member |
| `tenant_team_remove` | Remove a tenant member |
| `tenant_invitation_cancel` | Cancel a pending invitation |
| `tenant_domains_update` | Replace allowed email domains |
| `inference_capture_show` / `inference_capture_update` | Manage request-capture settings using credential-source references |

### Agents

| Tool | Description |
|------|-------------|
| `list_agents` | List available agents |
| `show_agent` | Agent details and capabilities |

### Account

| Tool | Description |
|------|-------------|
| `get_balance` | Account balance and recent transactions |
| `get_account` | Account details |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TE_API_KEY` | API key (overrides config file) |
| `TE_API_URL` | API URL (default: `https://app.tuningengines.com`) |

Tenant management commands keep the configured `te_*` API token local and
exchange it for a short-lived management JWT before calling the API. Inference
keys (`sk-te-*`) are for inference-only flows such as `te inference token` and
proxy calls; they are not accepted for tenant registry management commands.

## Inference Smoke Testing

Use `te-inference-smoke` to exercise inference behavior as a tenant admin and, optionally, real tenant users. The default run is read-only. Set `TE_SMOKE_MUTATE=1` to create temporary inference roles, keys, policies, guardrails, MCP servers, agents, and skills, then test permission permutations and clean them up.

If you only have an `sk-te-*` inference key, set `TE_INFERENCE_KEY` for
proxy-only checks. Full role/user/policy permutations require a tenant-admin
app API key that starts with `te_`.

```bash
TE_API_URL=https://app.tuningengines.com \
TE_ADMIN_API_KEY=te_admin_key_here \
TE_USER_API_KEY=te_user_key_here \
npx -y --package tuningengines-cli@latest te-inference-smoke
```

For actual proxy model calls, enable live calls explicitly:

```bash
TE_API_URL=https://app.tuningengines.com \
TE_INFERENCE_BASE=https://api.tuningengines.com/v1 \
TE_ADMIN_API_KEY=te_admin_key_here \
TE_SMOKE_MUTATE=1 \
TE_SMOKE_LIVE_CALLS=1 \
TE_SMOKE_CREATE_MODEL_DEPLOYMENT=1 \
TE_SMOKE_ALLOWED_MODEL=llama-3.1-8b-fast \
TE_SMOKE_DENIED_MODEL=llama-3.3-70b-fp8 \
TE_SMOKE_AGENT_URL=https://httpbin.org/post \
npx -y --package tuningengines-cli@latest te-inference-smoke
```

`TE_SMOKE_CREATE_MODEL_DEPLOYMENT=1` is useful for disposable tenants that do
not already have an enabled model. By default the runner treats a provider
authentication failure on an allowed model as proof that Tuning Engines RBAC
allowed the request through to the provider. Set
`TE_SMOKE_ALLOW_PROVIDER_AUTH_FAILURE=0` when the tenant has real provider
credentials and the allowed call must return `200`.

To test multiple tenant users, provide their API tokens:

```bash
TE_SMOKE_USERS_JSON='[
  {"email":"member1@example.com","api_key":"te_user_key_1"},
  {"email":"member2@example.com","api_key":"te_user_key_2"}
]' \
TE_ADMIN_API_KEY=te_admin_key_here \
TE_SMOKE_MUTATE=1 \
npx -y --package tuningengines-cli@latest te-inference-smoke
```

Preview coverage:

```bash
npx -y --package tuningengines-cli@latest te-inference-smoke --list
```

Each run writes a masked JSON report under `te-smoke-results/`, or to
`TE_SMOKE_REPORT` when that env var is set.

## Authentication

`te auth login` uses a secure device authorization flow (same pattern as `gh auth login`):

1. CLI generates a device code and opens your browser
2. Sign up or log in (email/password, Google, or GitHub)
3. Click "Authorize" to grant CLI access
4. Token flows back automatically — no copy-paste

Works for both new sign-ups and existing accounts. Token saved to `~/.tuningengines/config.json` with `0600` permissions.

## Links

- [Website](https://tuningengines.com)
- [MCP Registry](https://registry.modelcontextprotocol.io)
- [npm](https://www.npmjs.com/package/tuningengines-cli)
- [GitHub](https://github.com/cerebrixos-org/tuning-engines-cli)

## License

MIT
