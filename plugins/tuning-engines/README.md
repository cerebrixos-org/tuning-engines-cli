# Tuning Engines for Claude Code

This plugin connects Claude Code to the Tuning Engines MCP server.

Tuning Engines is a governed AI runtime for model, agent, skill, and MCP
workflows. The plugin exposes the public MCP tool surface for traces,
approvals, usage, registry metadata, evaluations, fine-tuning jobs, and other
tenant-scoped operations.

Set `TE_API_KEY` in your local environment before launching Claude Code. Do
not commit the key to a project file.

The MCP server intentionally excludes internal proxy routes, refuses MCP-side
inference-key creation, and rejects raw secret-bearing mutation fields.
