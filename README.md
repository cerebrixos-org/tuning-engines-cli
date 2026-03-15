# Tuning Engines CLI & MCP Server

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

The CLI includes a built-in MCP server with 18 tools. Any AI assistant that supports MCP can fine-tune models, manage training jobs, and check billing through natural language.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tuning-engines": {
      "command": "npx",
      "args": ["-y", "tuningengines-cli", "mcp", "serve"],
      "env": {
        "TE_API_KEY": "te_your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add tuning-engines -- npx -y tuningengines-cli mcp serve
```

### VS Code / Cursor / Windsurf

Add to your MCP settings (`.vscode/mcp.json` or equivalent):

```json
{
  "servers": {
    "tuning-engines": {
      "command": "npx",
      "args": ["-y", "tuningengines-cli", "mcp", "serve"],
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
| `list_models` | List trained and imported models |
| `show_model` | Model details (status, size, base model, training job) |
| `delete_model` | Delete a model from cloud storage |
| `import_model` | Import a model from S3 |
| `export_model` | Export a model to S3 |
| `model_status` | Import/export progress |
| `list_supported_models` | Available base models with GPU hours per epoch |
| `get_balance` | Account balance and recent transactions |
| `get_account` | Account details |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TE_API_KEY` | API key (overrides config file) |
| `TE_API_URL` | API URL (default: `https://app.tuningengines.com`) |

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
