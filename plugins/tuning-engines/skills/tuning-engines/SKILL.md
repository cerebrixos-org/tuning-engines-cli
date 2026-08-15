---
name: tuning-engines
description: Use Tuning Engines MCP tools for tenant-scoped AI governance, traces, approvals, usage, registries, evaluations, and fine-tuning operations.
---

# Tuning Engines

Use the `tuning-engines` MCP server when the user asks to inspect or operate
their Tuning Engines tenant.

## Safety

- Treat API keys, provider credentials, OAuth secrets, and inference keys as secrets.
- Never echo or store secret values in traces, files, comments, or command output.
- Confirm destructive mutations before executing them.
- Use tenant-scoped public MCP tools only; never attempt internal proxy routes.
- Prefer metadata-only traces unless the user explicitly enabled a broader capture mode.
- Explain approval, policy, and compliance decisions using returned evidence; do not invent it.

## Common Flows

1. Inspect traces and usage before diagnosing runtime behavior.
2. List pending approvals before attempting an approval-gated retry.
3. Read registry resources before creating or updating references.
4. Validate policies and resources before saving or enabling them.
5. Keep generated datasets, policies, workflows, and fine-tuning actions in review state until explicitly approved.
