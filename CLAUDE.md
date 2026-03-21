# Tuning Engines MCP Server

Fine-tune large language models and browse the Marketplace of pre-built models and datasets from your AI assistant using the Tuning Engines platform.

## Setup

```bash
npm install -g tuningengines-cli
te config set-token <your-te-api-key>
```

Or use environment variable: `export TE_API_KEY=te_...`

### Claude Desktop Configuration

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

## Available Tools

| Tool | Description |
|------|-------------|
| `list_jobs` | List training jobs with optional status filter |
| `show_job` | Get details of a specific training job |
| `create_job` | Submit a new fine-tuning training job |
| `cancel_job` | Cancel a running or queued job |
| `job_status` | Get live job status with GPU usage and charges |
| `retry_job` | Retry a failed job from its last checkpoint |
| `estimate_job` | Get a cost estimate before submitting |
| `list_models` | List your trained and imported models |
| `show_model` | Get details of a specific model |
| `delete_model` | Delete a model from cloud storage |
| `get_balance` | Check account balance and recent transactions |
| `list_catalog_models` | List pre-built models and datasets from the Marketplace |
| `get_catalog_model` | Get details of a Marketplace item |
| `export_catalog_model` | Export a Marketplace item to your S3 bucket |
| `catalog_export_status` | Check the status of a Marketplace export |

## Examples

- "List my training jobs" -> calls `list_jobs`
- "How much would it cost to fine-tune Llama 3.1 8B for 3 epochs?" -> calls `estimate_job`
- "Create a training job using my-repo for Llama 3.1 8B" -> calls `create_job`
- "What's the status of job abc-123?" -> calls `job_status`
- "Show my account balance" -> calls `get_balance`
- "List my trained models" -> calls `list_models`
- "Show me the marketplace" -> calls `list_catalog_models`
- "Export the Ruby specialist model to my S3" -> calls `export_catalog_model`
