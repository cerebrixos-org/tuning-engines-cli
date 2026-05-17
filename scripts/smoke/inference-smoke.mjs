#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const localCli = resolve(rootDir, "dist/cli.js");
const args = new Set(process.argv.slice(2));
const appUrl = trimSlash(process.env.TE_API_URL || "https://app.tuningengines.com");
const proxyBase = trimSlash(process.env.TE_INFERENCE_BASE || "https://api.tuningengines.com/v1");
const adminToken = process.env.TE_ADMIN_API_KEY || process.env.TE_API_KEY || "";
const userToken = process.env.TE_USER_API_KEY || "";
const mutate = process.env.TE_SMOKE_MUTATE === "1";
const liveCalls = process.env.TE_SMOKE_LIVE_CALLS === "1";
const unique = `inf-smoke-${Date.now()}`;
const tempHome = mkdtempSync(resolve(tmpdir(), "te-inference-smoke-"));
const reportPath = resolve(
  process.cwd(),
  process.env.TE_SMOKE_REPORT || `te-smoke-results/${unique}.json`
);
const results = [];
const cleanup = [];

const inferenceResources = [
  "inference_keys",
  "inference_roles",
  "model_deployments",
  "routing_profiles",
  "guardrail_policies",
  "governance_policies",
  "mcp_servers",
  "tenant_agents",
  "tenant_skills",
  "credential_sources",
];

if (args.has("--help") || args.has("-h")) {
  printHelp();
  process.exit(0);
}

if (args.has("--list")) {
  printPlan();
  process.exit(0);
}

if (!adminToken) {
  console.error("Missing TE_ADMIN_API_KEY. Set a tenant-admin API key before running inference smoke tests.");
  console.error("Use --list to preview coverage without secrets.");
  fail("missing TE_ADMIN_API_KEY", "Set TE_ADMIN_API_KEY to run live inference smoke tests.");
  writeReport(0);
  process.exit(2);
}

process.on("exit", () => {
  try {
    rmSync(tempHome, { recursive: true, force: true });
  } catch {
    // Best-effort only.
  }
});

await main();

async function main() {
  const started = Date.now();
  console.log(`Tuning Engines inference smoke`);
  console.log(`App API: ${appUrl}`);
  console.log(`Inference proxy: ${proxyBase}`);
  console.log(`Mode: ${mutate ? "read/write RBAC matrix" : "read-only"}`);
  console.log(`Live model/provider calls: ${liveCalls ? "enabled" : "disabled (set TE_SMOKE_LIVE_CALLS=1)"}`);

  await readOnlyInferenceSuite("admin", adminToken, true);
  if (userToken) {
    await readOnlyInferenceSuite("user", userToken, false);
  } else {
    skip("user inference metadata suite", "set TE_USER_API_KEY to validate tenant-user behavior");
  }

  if (mutate) {
    await rbacMatrixSuite();
  } else {
    skip("inference RBAC matrix", "set TE_SMOKE_MUTATE=1 to create temporary roles/keys/resources and test allow/deny behavior");
  }

  await cleanupCreatedResources();
  printSummary(Date.now() - started);
  writeReport(Date.now() - started);
  process.exit(results.some((result) => result.status === "failed") ? 1 : 0);
}

async function readOnlyInferenceSuite(role, token, isAdmin) {
  section(`${role} inference metadata`);
  runCli(role, token, "te inference models", ["inference", "models", "--json"]);
  runCli(role, token, "te inference usage", ["inference", "usage", "--json"]);
  const jwt = runJson(role, token, "te inference jwt", ["inference", "jwt", "--json"], { maskStdout: true, allowFailure: true });
  if (jwt?.token) {
    await httpStep(`${role}: proxy /models using JWT`, "GET", "/models", { bearer: jwt.token });
  }

  if (isAdmin) {
    runCli(role, token, "te tenant capture show", ["tenant", "capture", "show", "--json"]);
    for (const resource of inferenceResources) {
      const listed = runJson(role, token, `te tenant list ${resource}`, ["tenant", "list", resource, "--limit", "20", "--json"]);
      const id = firstId(listed);
      if (id) {
        runCli(role, token, `te tenant show ${resource}`, ["tenant", "show", resource, id, "--json"]);
      } else {
        skip(`${role}: te tenant show ${resource}`, "no existing resource id found");
      }
    }
  } else {
    runCli(role, token, "tenant admin route forbidden", ["tenant", "list", "inference_roles", "--json"], { expectFailure: true });
  }
}

async function rbacMatrixSuite() {
  section("inference RBAC matrix");

  const unrestrictedKey = createInferenceKey("unrestricted", null);
  const modelList = await proxyModels(unrestrictedKey);
  const selectedModels = selectModels(modelList);
  const allowedModel = process.env.TE_SMOKE_ALLOWED_MODEL || selectedModels.allowed;
  const deniedModel = process.env.TE_SMOKE_DENIED_MODEL || selectedModels.denied;

  if (!allowedModel) {
    skip("model allow/deny matrix", "no proxy model discovered; set TE_SMOKE_ALLOWED_MODEL");
  }

  const roleId = createTenantResource("inference_roles", {
    name: `${unique}-model-role`,
    description: "Inference smoke: only one model allowed",
    allowed_models: allowedModel ? [allowedModel] : ["__no_model__"],
    allowed_agents: [],
    allowed_skills: [],
    allowed_mcp_server_ids: [],
    allowed_tenant_agent_ids: [],
    allowed_tenant_skill_ids: [],
    allowed_user_model_ids: [],
    allowed_tool_ids: [],
  });
  const restrictedKey = createInferenceKey("restricted-model-key", roleId);

  const denyAllRoleId = createTenantResource("inference_roles", {
    name: `${unique}-deny-all-role`,
    description: "Inference smoke: denies model/resource access through impossible allowlists",
    allowed_models: ["__te_smoke_no_such_model__"],
    allowed_agents: ["__te_smoke_no_such_agent__"],
    allowed_skills: ["__te_smoke_no_such_skill__"],
    allowed_mcp_server_ids: [0],
    allowed_tenant_agent_ids: [0],
    allowed_tenant_skill_ids: [0],
    allowed_user_model_ids: [0],
    allowed_tool_ids: [0],
  });
  const denyAllKey = createInferenceKey("deny-all-key", denyAllRoleId);

  await httpStep("app token exchange rejects invalid inference key", "POST", `${appUrl}/api/v1/inference/token`, {
    absolute: true,
    bearer: "sk-te-invalid-smoke-key",
    expectStatus: [401],
  });
  await httpStep("app token exchange accepts restricted inference key", "POST", `${appUrl}/api/v1/inference/token`, {
    absolute: true,
    bearer: restrictedKey,
    expectStatus: [200],
  });
  await httpStep("restricted key can list proxy models", "GET", "/models", { bearer: restrictedKey });

  if (liveCalls && allowedModel) {
    await httpStep(`allowed model call succeeds: ${allowedModel}`, "POST", "/chat/completions", {
      bearer: restrictedKey,
      json: {
        model: allowedModel,
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
        max_tokens: 8,
        temperature: 0,
      },
      expectStatus: [200],
    });
  } else {
    skip("allowed model chat call", "set TE_SMOKE_LIVE_CALLS=1 and provide/discover TE_SMOKE_ALLOWED_MODEL");
  }

  if (liveCalls && deniedModel) {
    await httpStep(`denied model call is blocked: ${deniedModel}`, "POST", "/chat/completions", {
      bearer: restrictedKey,
      json: {
        model: deniedModel,
        messages: [{ role: "user", content: "This should be denied by role allowlist." }],
        max_tokens: 8,
      },
      expectStatus: [400, 401, 403, 404],
    });
  } else {
    skip("denied model chat call", "need TE_SMOKE_LIVE_CALLS=1 and a second model via TE_SMOKE_DENIED_MODEL or proxy /models");
  }

  if (liveCalls && allowedModel) {
    await httpStep(`deny-all key blocks normally allowed model: ${allowedModel}`, "POST", "/chat/completions", {
      bearer: denyAllKey,
      json: {
        model: allowedModel,
        messages: [{ role: "user", content: "This should be denied by deny-all role." }],
        max_tokens: 8,
      },
      expectStatus: [400, 401, 403, 404],
    });
  } else {
    skip("deny-all key live model denial", "set TE_SMOKE_LIVE_CALLS=1 and provide/discover TE_SMOKE_ALLOWED_MODEL");
  }

  await governanceAndGuardrailSuite(restrictedKey);
  const resourceRoleId = await mcpAgentSkillSuite(allowedModel);
  await userPermutationSuite([
    { label: "model-only", roleId, allowedModel, shouldAllowModel: true },
    { label: "deny-all", roleId: denyAllRoleId, allowedModel, shouldAllowModel: false },
    { label: "resource-role", roleId: resourceRoleId, allowedModel, shouldAllowModel: true },
  ]);
}

async function governanceAndGuardrailSuite(inferenceKey) {
  section("governance, guardrails, capture");
  const policyId = createTenantResource("governance_policies", {
    name: `${unique}-deny-tool`,
    description: "Inference smoke AGT policy",
    scope: "all",
    enabled: true,
    priority: 1,
    policy_yaml: [
      'version: "1.0"',
      `name: ${unique}-deny-tool`,
      "rules:",
      "  - name: deny-smoke-tool",
      "    condition:",
      "      field: tool_name",
      "      operator: eq",
      "      value: forbidden_smoke_tool",
      "    action: deny",
      "    priority: 100",
      '    message: "blocked by inference smoke"',
      "defaults:",
      "  action: allow",
    ].join("\n"),
  });

  if (policyId) {
    runCli("admin", adminToken, "governance policy denies matching context", [
      "tenant",
      "test-policy",
      policyId,
      "--context",
      JSON.stringify({ tool_name: "forbidden_smoke_tool" }),
      "--json",
    ]);
    runCli("admin", adminToken, "governance policy allows non-matching context", [
      "tenant",
      "test-policy",
      policyId,
      "--context",
      JSON.stringify({ tool_name: "allowed_smoke_tool" }),
      "--json",
    ]);
  }

  createTenantResource("guardrail_policies", {
    name: `${unique}-regex-block`,
    guardrail_type: "custom_regex",
    phase: "pre_call",
    action: "block",
    enabled: true,
    priority: 1,
    config: { patterns: ["TE_SMOKE_BLOCK_ME"] },
  });

  runCli("admin", adminToken, "capture disable update", [
    "tenant",
    "capture",
    "update",
    "--data",
    JSON.stringify({ enabled: false }),
    "--json",
  ], { allowFailure: true });

  if (liveCalls && process.env.TE_SMOKE_GUARDRAIL_MODEL) {
    await httpStep("guardrail blocks matching prompt", "POST", "/chat/completions", {
      bearer: inferenceKey,
      json: {
        model: process.env.TE_SMOKE_GUARDRAIL_MODEL,
        messages: [{ role: "user", content: "TE_SMOKE_BLOCK_ME" }],
        max_tokens: 8,
      },
      expectStatus: [400, 403, 422],
    });
  } else {
    skip("guardrail live blocking call", "set TE_SMOKE_LIVE_CALLS=1 and TE_SMOKE_GUARDRAIL_MODEL to verify proxy enforcement");
  }
}

async function mcpAgentSkillSuite(allowedModel) {
  section("MCP, agent, and skill permissions");
  let mcpId = null;
  if (process.env.TE_SMOKE_MCP_SERVER_URL) {
    mcpId = createTenantResource("mcp_servers", {
      name: `${unique}-mcp`,
      description: "Inference smoke MCP server",
      url: process.env.TE_SMOKE_MCP_SERVER_URL,
      transport: process.env.TE_SMOKE_MCP_TRANSPORT || "sse",
      auth_method: "none",
      enabled: true,
    });
  } else {
    skip("MCP resource creation", "set TE_SMOKE_MCP_SERVER_URL to create and exercise an externally reachable MCP server");
  }

  let agentId = null;
  const agentName = `${unique}-agent`;
  if (process.env.TE_SMOKE_AGENT_URL) {
    agentId = createTenantResource("tenant_agents", {
      name: agentName,
      description: "Inference smoke agent",
      url: process.env.TE_SMOKE_AGENT_URL,
      auth_method: "none",
      enabled: true,
    });
  } else {
    skip("agent resource creation", "set TE_SMOKE_AGENT_URL to create and exercise an externally reachable agent endpoint");
  }

  const skillId = createTenantResource("tenant_skills", {
    name: `${unique}-skill`,
    description: "Inference smoke skill",
    source_url: "https://example.com/te-smoke-skill",
    domain: "smoke",
    auth_method: "none",
    enabled: true,
  });

  const resourceRoleId = createTenantResource("inference_roles", {
    name: `${unique}-resource-role`,
    description: "Inference smoke: resource allowlists",
    allowed_models: allowedModel ? [allowedModel] : [],
    allowed_mcp_server_ids: mcpId ? [Number(mcpId)] : [0],
    allowed_tenant_agent_ids: agentId ? [Number(agentId)] : [0],
    allowed_tenant_skill_ids: skillId ? [Number(skillId)] : [0],
    allowed_agents: [],
    allowed_skills: [],
  });
  const resourceKey = createInferenceKey("resource-key", resourceRoleId);
  const tokenPayload = await exchangeJwtPayload(resourceKey);

  assertJwtArray(tokenPayload, "role_allowed_mcp_server_ids", mcpId);
  assertJwtArray(tokenPayload, "role_allowed_tenant_agent_ids", agentId);
  assertJwtArray(tokenPayload, "role_allowed_tenant_skill_ids", skillId);

  await httpStep("proxy MCP tool discovery reflects key permissions", "GET", "/mcp/tools", {
    bearer: resourceKey,
    expectStatus: [200, 204, 404, 501],
    allowFailure: true,
  });

  if (process.env.TE_SMOKE_MCP_TOOL_NAME) {
    await httpStep("proxy MCP tool call", "POST", "/mcp/tools/call", {
      bearer: resourceKey,
      json: {
        name: process.env.TE_SMOKE_MCP_TOOL_NAME,
        arguments: parseJsonEnv("TE_SMOKE_MCP_TOOL_ARGS", {}),
      },
      expectStatus: [200],
    });
  } else {
    skip("proxy MCP tool call", "set TE_SMOKE_MCP_TOOL_NAME after MCP discovery is available");
  }

  if (agentId && process.env.TE_SMOKE_AGENT_URL) {
    await httpStep("proxy agent message call", "POST", `/agents/${encodeURIComponent(agentName)}/message`, {
      bearer: resourceKey,
      json: {
        message: "smoke test",
        context: { source: "te-inference-smoke" },
      },
      expectStatus: [200],
      allowFailure: true,
    });
  } else {
    skip("proxy agent message call", "set TE_SMOKE_AGENT_URL to create an externally reachable test agent");
  }

  return resourceRoleId;
}

async function userPermutationSuite(permutations) {
  section("tenant user role permutations");
  const users = smokeUsers();
  if (users.length === 0) {
    skip("tenant user permutations", "set TE_SMOKE_USERS_JSON='[{\"email\":\"member@example.com\",\"api_key\":\"te_...\"}]' or TE_USER_API_KEY + TE_SMOKE_USER_EMAIL");
    return;
  }

  const team = runJson("admin", adminToken, "tenant team list", ["tenant", "team", "list", "--json"]);
  for (let index = 0; index < users.length; index += 1) {
    const smokeUser = users[index];
    const member = Array.isArray(team?.members)
      ? team.members.find((u) => String(u.email).toLowerCase() === smokeUser.email.toLowerCase())
      : null;
    if (!member) {
      skip(`tenant user ${smokeUser.email}`, "email not found in tenant team; invite/accept user first");
      continue;
    }

    const previousRoleId = member.inference_role_id;
    const selected = permutations[index % permutations.length];
    if (!selected?.roleId) {
      skip(`tenant user ${smokeUser.email}`, `role for permutation ${selected?.label || index} was not created`);
      continue;
    }

    runCli("admin", adminToken, `assign ${selected.label} role to ${smokeUser.email}`, [
      "tenant",
      "team",
      "set-role",
      String(member.id),
      "--inference-role-id",
      String(selected.roleId),
      "--json",
    ]);

    const userJwt = runJson("user", smokeUser.api_key, `${smokeUser.email} inference jwt`, ["inference", "jwt", "--json"], {
      maskStdout: true,
      allowFailure: true,
    });
    if (userJwt?.token) {
      await httpStep(`${smokeUser.email}: proxy /models with assigned role`, "GET", "/models", { bearer: userJwt.token });
      if (liveCalls && selected.allowedModel) {
        await httpStep(`${smokeUser.email}: ${selected.shouldAllowModel ? "allowed" : "denied"} model call`, "POST", "/chat/completions", {
          bearer: userJwt.token,
          json: {
            model: selected.allowedModel,
            messages: [{ role: "user", content: "Reply with exactly: ok" }],
            max_tokens: 8,
          },
          expectStatus: selected.shouldAllowModel ? [200] : [400, 401, 403, 404],
        });
      } else {
        skip(`${smokeUser.email}: live model call`, "set TE_SMOKE_LIVE_CALLS=1 and provide/discover an allowed model");
      }
    } else {
      fail(`${smokeUser.email}: inference jwt`, "user token could not be exchanged for inference JWT");
    }

    if (previousRoleId) {
      runCli("admin", adminToken, `restore previous role for ${smokeUser.email}`, [
        "tenant",
        "team",
        "set-role",
        String(member.id),
        "--inference-role-id",
        String(previousRoleId),
        "--json",
      ], { allowFailure: true });
    }
  }
}

function createInferenceKey(label, roleId) {
  const data = {
    name: `${unique}-${label}`,
    scopes: ["inference", "models:read"],
    budget_usd: "1.00",
  };
  if (roleId) data.inference_role_id = roleId;
  const result = runJson("admin", adminToken, `create inference key ${label}`, [
    "tenant",
    "create",
    "inference_keys",
    "--data",
    JSON.stringify(data),
    "--json",
  ], { maskStdout: true });
  const id = firstId(result);
  if (id) cleanup.push(["inference_keys", id]);
  if (!result?.api_key) throw new Error(`Could not create inference key for ${label}`);
  return result.api_key;
}

function createTenantResource(resource, data) {
  const result = runJson("admin", adminToken, `create ${resource}`, [
    "tenant",
    "create",
    resource,
    "--data",
    JSON.stringify(data),
    "--json",
  ], { allowFailure: true, maskStdout: resource === "inference_keys" });
  const id = firstId(result);
  if (id) cleanup.push([resource, id]);
  return id;
}

async function cleanupCreatedResources() {
  section("cleanup");
  for (const [resource, id] of cleanup.reverse()) {
    runCli("admin", adminToken, `delete ${resource} ${id}`, ["tenant", "delete", resource, String(id), "--json"], {
      allowFailure: true,
      maskStdout: resource === "inference_keys",
    });
  }
}

async function proxyModels(bearer) {
  const response = await httpStep("discover proxy models with unrestricted key", "GET", "/models", { bearer, expectStatus: [200] });
  return normalizeModels(response?.json);
}

function selectModels(models) {
  const names = models.map((m) => m.id || m.model || m.name).filter(Boolean);
  return { allowed: names[0] || null, denied: names.find((name) => name !== names[0]) || null };
}

function normalizeModels(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.models)) return payload.models;
  if (Array.isArray(payload)) return payload;
  return [];
}

async function exchangeJwtPayload(inferenceKey) {
  const response = await httpStep("exchange inference key for JWT", "POST", `${appUrl}/api/v1/inference/token`, {
    absolute: true,
    bearer: inferenceKey,
    expectStatus: [200],
    maskBody: true,
  });
  const token = response?.json?.token;
  if (!token) return null;
  return decodeJwt(token);
}

function assertJwtArray(payload, field, expectedId) {
  if (!expectedId || !payload) {
    skip(`JWT claim ${field}`, "missing expected id or JWT payload");
    return;
  }
  const values = Array(payload[field] || payload.permissions?.[field]).map(String);
  if (values.includes(String(expectedId))) {
    pass(`jwt: ${field} contains ${expectedId}`);
  } else {
    fail(`jwt: ${field} contains ${expectedId}`, `Actual: ${JSON.stringify(values)}`);
  }
}

async function httpStep(name, method, path, options = {}) {
  const started = Date.now();
  const url = options.absolute ? path : `${proxyBase}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (options.bearer) headers.Authorization = `Bearer ${options.bearer}`;
  let body;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }
  let status = 0;
  let text = "";
  let json = null;
  try {
    const response = await fetch(url, { method, headers, body });
    status = response.status;
    text = await response.text();
    json = parseJson(text);
  } catch (error) {
    return record("http", name, options.allowFailure ? "allowed-failure" : "failed", Date.now() - started, 0, "", error.message);
  }
  const expected = options.expectStatus || [200];
  const ok = expected.includes(status);
  const statusName = ok ? "passed" : options.allowFailure ? "allowed-failure" : "failed";
  record("http", name, statusName, Date.now() - started, status, options.maskBody ? "" : text, "");
  return { status, text, json };
}

function runCli(role, token, name, commandArgs, options = {}) {
  const started = Date.now();
  const env = {
    ...process.env,
    TE_API_URL: appUrl,
    TE_API_KEY: token,
    HOME: tempHome,
  };
  delete env.TE_ADMIN_API_KEY;
  delete env.TE_USER_API_KEY;
  const executable = cliExecutable();
  const spawned = spawnSync(executable.command, [...executable.args, ...commandArgs], {
    cwd: rootDir,
    env,
    encoding: "utf8",
    timeout: Number(process.env.TE_SMOKE_TIMEOUT_MS || 30000),
  });
  const exitCode = spawned.status ?? 1;
  const expectedFailure = Boolean(options.expectFailure);
  const passed = expectedFailure ? exitCode !== 0 : exitCode === 0 || Boolean(options.allowFailure);
  const status = passed ? (exitCode === 0 ? "passed" : "allowed-failure") : "failed";
  record(role, name, status, Date.now() - started, exitCode, spawned.stdout || "", spawned.stderr || "", options.maskStdout);
  return { stdout: spawned.stdout || "", stderr: spawned.stderr || "", exitCode };
}

function runJson(role, token, name, commandArgs, options = {}) {
  const result = runCli(role, token, name, commandArgs, options);
  return parseJson(result.stdout);
}

function cliExecutable() {
  if (!existsSync(localCli)) {
    throw new Error(`CLI build not found at ${localCli}. Run npm run build first.`);
  }
  return { command: process.execPath, args: [localCli] };
}

function record(role, name, status, elapsed, exitCode, stdout = "", stderr = "", maskStdout = false) {
  const safeStdout = mask(stdout, maskStdout);
  const safeStderr = mask(stderr, maskStdout);
  results.push({ role, name, status, elapsed, exitCode, stdout: safeStdout, stderr: safeStderr });
  const marker = status === "passed" ? "PASS" : status === "skipped" ? "SKIP" : status === "allowed-failure" ? "WARN" : "FAIL";
  console.log(`[${marker}] ${role}: ${name} (${elapsed}ms)`);
  if (status !== "passed" && status !== "skipped") {
    const out = `${safeStdout}\n${safeStderr}`.trim();
    if (out) console.log(indent(out));
  }
}

function pass(name) {
  record("assert", name, "passed", 0, 0);
}

function fail(name, message) {
  record("assert", name, "failed", 0, 1, "", message);
}

function skip(name, reason) {
  results.push({ role: "skip", name, status: "skipped", reason, elapsed: 0, exitCode: 0 });
  console.log(`[SKIP] ${name}: ${reason}`);
}

function section(title) {
  console.log("");
  console.log(`== ${title} ==`);
}

function firstId(value) {
  if (!value) return null;
  if (Array.isArray(value)) return firstId(value[0]);
  if (typeof value === "object") {
    if (value.id) return String(value.id);
    if (value.uuid) return String(value.uuid);
    if (value.data) return firstId(value.data);
    if (value.record) return firstId(value.record);
  }
  return null;
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseJsonEnv(name, fallback) {
  try {
    return process.env[name] ? JSON.parse(process.env[name]) : fallback;
  } catch {
    return fallback;
  }
}

function smokeUsers() {
  const users = parseJsonEnv("TE_SMOKE_USERS_JSON", null);
  if (Array.isArray(users)) {
    return users
      .filter((user) => user?.email && user?.api_key)
      .map((user) => ({ email: String(user.email), api_key: String(user.api_key) }));
  }
  if (process.env.TE_SMOKE_USER_EMAIL && userToken) {
    return [{ email: process.env.TE_SMOKE_USER_EMAIL, api_key: userToken }];
  }
  return [];
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function mask(text, maskAll = false) {
  const secrets = [adminToken, userToken, process.env.TE_INFERENCE_KEY].filter(Boolean);
  let masked = String(text);
  for (const secret of secrets) masked = masked.split(secret).join("[secret]");
  masked = masked
    .replace(/te_[A-Za-z0-9._-]{8,}/g, "te_[redacted]")
    .replace(/sk-te-[A-Za-z0-9._-]{8,}/g, "sk-te-[redacted]")
    .replace(/"api_key"\s*:\s*"[^"]+"/g, '"api_key":"[redacted]"')
    .replace(/"token"\s*:\s*"[^"]+"/g, '"token":"[redacted]"');
  return maskAll ? "[redacted]" : masked;
}

function indent(text) {
  return String(text).split("\n").slice(0, 18).map((line) => `  ${line}`).join("\n");
}

function trimSlash(value) {
  return String(value).replace(/\/$/, "");
}

function printSummary(elapsed) {
  const counts = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
  console.log("");
  console.log("== Summary ==");
  console.log(`Elapsed: ${elapsed}ms`);
  console.log(`Passed: ${counts.passed || 0}`);
  console.log(`Warnings: ${counts["allowed-failure"] || 0}`);
  console.log(`Skipped: ${counts.skipped || 0}`);
  console.log(`Failed: ${counts.failed || 0}`);
  console.log(`Report: ${reportPath}`);
}

function writeReport(elapsed) {
  const counts = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
  const report = {
    name: "te-inference-smoke",
    unique,
    started_at: new Date(Number(unique.replace("inf-smoke-", "")) || Date.now()).toISOString(),
    finished_at: new Date().toISOString(),
    elapsed_ms: elapsed,
    app_url: appUrl,
    inference_base: proxyBase,
    mode: {
      mutate,
      live_calls: liveCalls,
    },
    counts,
    results,
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function printHelp() {
  console.log(`Usage:
  te-inference-smoke --list
  TE_ADMIN_API_KEY=te_... te-inference-smoke
  TE_ADMIN_API_KEY=te_... TE_SMOKE_MUTATE=1 TE_SMOKE_LIVE_CALLS=1 te-inference-smoke

Important env:
  TE_API_URL                 App API URL. Default: https://app.tuningengines.com
  TE_INFERENCE_BASE          Proxy /v1 base. Default: https://api.tuningengines.com/v1
  TE_ADMIN_API_KEY           Required tenant-admin API key.
  TE_USER_API_KEY            Optional tenant-user API key.
  TE_SMOKE_MUTATE=1          Creates temporary roles, keys, policies, resources.
  TE_SMOKE_LIVE_CALLS=1      Makes chargeable/real proxy model calls.
  TE_SMOKE_ALLOWED_MODEL     Model expected to be allowed.
  TE_SMOKE_DENIED_MODEL      Model expected to be denied.
  TE_SMOKE_USER_EMAIL        Tenant user email for role assignment.
  TE_SMOKE_USERS_JSON        Multiple users: [{"email":"...","api_key":"te_..."}]
  TE_SMOKE_MCP_SERVER_URL    External test MCP SSE server.
  TE_SMOKE_MCP_TOOL_NAME     Tool to call through /v1/mcp/tools/call.
  TE_SMOKE_AGENT_URL         External test agent endpoint.
`);
}

function printPlan() {
  console.log("Inference-only smoke coverage:");
  [
    "CLI/app metadata: inference models, usage, JWT, capture settings",
    "Admin resource inventory: keys, roles, deployments, routing, guardrails, governance, MCP, agents, skills, credentials",
    "Temporary inference keys and JWT exchange",
    "Invalid key rejection",
    "Role model allowlist: allowed model succeeds, denied model is blocked",
    "Tenant-user role assignment via team set-role, with user JWT/proxy check",
    "Multiple tenant-user permutations via TE_SMOKE_USERS_JSON",
    "Governance policy creation and dry-run allow/deny evaluation",
    "Guardrail creation plus optional live blocking call",
    "MCP server, agent, and skill allowlist claims in issued JWT",
    "Optional proxy MCP discovery/tool call and agent message call using external test endpoints",
  ].forEach((item) => console.log(`- ${item}`));
}
