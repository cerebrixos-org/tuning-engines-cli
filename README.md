# Tuning Engines CLI & MCP Server

[![tuning-engines-cli MCP server](https://glama.ai/mcp/servers/cerebrixos-org/tuning-engines-cli/badges/card.svg)](https://glama.ai/mcp/servers/cerebrixos-org/tuning-engines-cli)

[![npm version](https://img.shields.io/npm/v/tuningengines-cli.svg)](https://www.npmjs.com/package/tuningengines-cli)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-tuning--engines-blue)](https://registry.modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Own your sovereign AI model. Domain-specific fine-tuning of open-source LLMs and SLMs with total control and zero infrastructure hassle.

**[Tuning Engines](https://tuningengines.com)** provides specialized tuning agents to tailor top open models to your needs — fast, predictable, fully delivered. Fine-tune Qwen, Llama, DeepSeek, Mistral, Gemma, Phi, StarCoder, and CodeLlama models from 1B to 72B parameters on your data via CLI or any MCP-compatible AI assistant. LoRA, QLoRA, and full fine-tuning supported. GPU provisioning, training orchestration, and model delivery fully managed.

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
```

## MCP Server Setup

The CLI includes a built-in MCP server with 35+ tools. Any AI assistant that supports MCP can fine-tune models, manage training jobs, run evaluations, check inference usage, and manage datasets through natural language.

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

## Agent Runtime SDK: LangGraph and Temporal

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
`POST /api/v1/traces`. The Rails app pairs that with existing inference usage,
request capture, policy, audit, and billing logs.

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
| `te tenant test-policy <id> --context '<json>'` | Dry-run an AGT YAML governance policy |
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
| `validate_s3` | Test S3 credentials before submitting a job |

### Models

| Tool | Description |
|------|-------------|
| `list_models` | List trained and imported models |
| `show_model` | Model details (status, size, base model, training job) |
| `delete_model` | Delete a model from cloud storage |
| `import_model` | Import a model from S3 |
| `export_model` | Export a model to S3 |
| `model_status` | Import/export progress |
| `list_supported_models` | Available base models with GPU hours per epoch |

### Marketplace

| Tool | Description |
|------|-------------|
| `list_catalog_models` | Browse pre-built models and datasets |
| `get_catalog_model` | Details of a marketplace item |
| `export_catalog_model` | Export marketplace item to S3 |
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
