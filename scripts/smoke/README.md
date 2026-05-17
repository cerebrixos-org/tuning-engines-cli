# Inference smoke tests

`te-inference-smoke` exercises inference behavior through the same CLI/app API and proxy paths a tenant admin or tenant user would use.

It focuses on inference only:

- inference metadata and JWT exchange
- keys and roles
- model deployment/routing inventory
- model allow/deny behavior through roles
- governance policy dry-runs
- guardrail configuration and optional live enforcement checks
- MCP, agent, and skill registry permissions
- user role assignment permutations when user API tokens are supplied

## Read-only metadata smoke

```bash
TE_API_URL=https://app.tuningengines.com \
TE_ADMIN_API_KEY=te_admin_key_here \
npm run smoke:inference
```

## Role and permission matrix

This mode creates temporary roles, inference keys, policies, guardrails, MCP/agent/skill records, then removes the records it created.

```bash
TE_API_URL=https://app.tuningengines.com \
TE_INFERENCE_BASE=https://api.tuningengines.com/v1 \
TE_ADMIN_API_KEY=te_admin_key_here \
TE_SMOKE_MUTATE=1 \
npm run smoke:inference
```

## Live model calls

Live calls can spend inference credits, so they are explicit:

```bash
TE_API_URL=https://app.tuningengines.com \
TE_INFERENCE_BASE=https://api.tuningengines.com/v1 \
TE_ADMIN_API_KEY=te_admin_key_here \
TE_SMOKE_MUTATE=1 \
TE_SMOKE_LIVE_CALLS=1 \
TE_SMOKE_ALLOWED_MODEL=llama-3.3-70b-fp8 \
TE_SMOKE_DENIED_MODEL=gpt-4o-mini \
npm run smoke:inference
```

## Tenant user permutations

To test actual tenant-user behavior, provide user API tokens. Tenant admins can assign roles, but they should not be able to mint another user's API token.

```bash
TE_SMOKE_USERS_JSON='[
  {"email":"member1@example.com","api_key":"te_user_key_1"},
  {"email":"member2@example.com","api_key":"te_user_key_2"}
]' \
TE_ADMIN_API_KEY=te_admin_key_here \
TE_SMOKE_MUTATE=1 \
TE_SMOKE_LIVE_CALLS=1 \
npm run smoke:inference
```

The harness cycles users through model-only, deny-all, and resource-role permutations, then restores previous inference roles where possible.

## MCP and agent execution

Discovery and permission claims are tested automatically. Actual remote execution needs externally reachable test endpoints:

```bash
TE_SMOKE_MCP_SERVER_URL=https://your-test-mcp.example.com/sse \
TE_SMOKE_MCP_TOOL_NAME=echo \
TE_SMOKE_MCP_TOOL_ARGS='{"text":"hello"}' \
TE_SMOKE_AGENT_URL=https://your-test-agent.example.com/message \
npm run smoke:inference
```

Preview coverage:

```bash
npm run smoke:inference -- --list
```

After package publish:

```bash
TE_ADMIN_API_KEY=te_admin_key_here \
npx -y --package tuningengines-cli@latest te-inference-smoke --list
```

Secrets are masked in failure output, and the script uses a temporary `HOME` so config checks do not touch a developer's real CLI config.
