# Tuning Engines Plugin

This plugin connects Codex and Claude Code to the Tuning Engines MCP server.

Tuning Engines is a governed AI runtime for model, agent, skill, and MCP
workflows. The plugin exposes the public MCP tool surface for traces,
approvals, usage, registry metadata, evaluations, fine-tuning jobs, and other
tenant-scoped operations.

Set `TE_API_KEY` in your local environment before launching Claude Code. Do
not commit the key to a project file.

The Codex package includes a marketplace manifest, the same MCP server, and a
tenant-operations skill. It uses the existing Tuning Engines web application as
the control-plane UI rather than embedding a second dashboard in the plugin.

The MCP server intentionally excludes internal proxy routes, refuses MCP-side
inference-key creation, and rejects raw secret-bearing mutation fields.
