# Install the Tuning Engines MCP Server

Tuning Engines provides a governed AI runtime and fine-tuning control plane
through a public npm package. The MCP server uses stdio transport and reads the
user's Tuning Engines API key from the `TE_API_KEY` environment variable.

Do not print, log, commit, or request the plaintext value of `TE_API_KEY`.

## Run with npx

```bash
npx -y --package tuningengines-cli@latest te mcp serve
```

## Claude Code

```bash
claude mcp add tuning-engines -- npx -y --package tuningengines-cli@latest te mcp serve
```

The user must set `TE_API_KEY` in their local environment before launching the
client.

## JSON configuration

```json
{
  "mcpServers": {
    "tuning-engines": {
      "command": "npx",
      "args": ["-y", "--package", "tuningengines-cli@latest", "te", "mcp", "serve"],
      "env": {
        "TE_API_KEY": "${TE_API_KEY}"
      }
    }
  }
}
```

## Security boundary

The MCP server intentionally excludes internal proxy routes, refuses
MCP-side inference-key creation, and rejects raw secret-bearing mutation
fields. Use the Tuning Engines web app or CLI for workflows that intentionally
create one-time keys or submit provider credentials.
