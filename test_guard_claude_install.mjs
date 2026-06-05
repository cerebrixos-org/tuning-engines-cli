import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const cli = path.join(process.cwd(), "dist", "cli.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "te-claude-install-"));

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      TE_API_KEY: options.apiKey ?? "sk-te-test-token-for-doctor",
      TE_API_URL: options.apiUrl ?? process.env.TE_API_URL,
      PATH: options.path ?? process.env.PATH,
    },
  });
  if (result.status !== 0) {
    const error = new Error(`Command failed: te ${args.join(" ")}`);
    error.status = result.status;
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }
  return `${result.stdout}${result.stderr}`;
}

function runAsync(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        TE_API_KEY: options.apiKey ?? "sk-te-test-token-for-doctor",
        TE_API_URL: options.apiUrl ?? process.env.TE_API_URL,
        PATH: options.path ?? process.env.PATH,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("exit", (status) => {
      if (status !== 0) {
        const error = new Error(`Command failed: te ${args.join(" ")}`);
        error.status = status;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(`${stdout}${stderr}`);
    });
  });
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function startFakeApi() {
  const traces = new Map();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "POST" && url.pathname === "/api/v1/auth/token") {
        await readRequestJson(req).catch(() => ({}));
        json(res, 200, { access_token: "access-token", expires_in: 900 });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/v1/agent_actions/evaluate") {
        await readRequestJson(req);
        json(res, 200, { decision: { allowed: true, reason: "probe allowed" } });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/v1/traces") {
        const body = await readRequestJson(req);
        const runId = body.run_id;
        const existing = traces.get(runId) || { run_id: runId, request_id: body.request_id, events: [], metadata: {} };
        existing.events.push(...(Array.isArray(body.events) ? body.events : []));
        existing.metadata = { ...existing.metadata, ...(body.metadata || {}) };
        traces.set(runId, existing);
        json(res, 200, { ok: true, run_id: runId });
        return;
      }
      const traceMatch = url.pathname.match(/^\/api\/v1\/traces\/(.+)$/);
      if (req.method === "GET" && traceMatch) {
        const runId = decodeURIComponent(traceMatch[1]);
        if (!traces.has(runId)) {
          json(res, 404, { error: { message: "trace not found" } });
          return;
        }
        json(res, 200, { trace: traces.get(runId) });
        return;
      }
      json(res, 404, { error: { message: `unexpected ${req.method} ${url.pathname}` } });
    } catch (err) {
      json(res, 500, { error: { message: err.message } });
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    apiUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => {
      if (typeof server.closeAllConnections === "function") server.closeAllConnections();
      server.close(resolve);
    }),
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const project = path.join(tmp, "disaster-management-rag");
fs.mkdirSync(project, { recursive: true });

const sibling = `${project}.claude`;
fs.mkdirSync(path.join(sibling, "commands"), { recursive: true });
fs.writeFileSync(path.join(sibling, "commands", "custom.md"), "# keep me\n");

const installOutput = run([
  "guard",
  "claude-code",
  "install",
  "--project",
  project,
  "--mode",
  "observe",
  "--migrate-sibling",
]);

const settingsPath = path.join(project, ".claude", "settings.local.json");
assert.ok(fs.existsSync(settingsPath), "settings.local.json should be written under project/.claude");
assert.ok(!fs.existsSync(path.join(`${project}.claude`, "settings.local.json")), "install must not write settings into sibling project.claude");
assert.ok(fs.existsSync(path.join(project, ".claude", "commands", "custom.md")), "migrate-sibling should copy missing sibling commands");
assert.match(installOutput, /Warning: found .*disaster-management-rag\.claude/);
assert.match(installOutput, /dir \.\\\.claude/);
assert.match(installOutput, /claude \/hooks/);

const settings = readJson(settingsPath);
for (const event of ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure", "Stop"]) {
  assert.ok(Array.isArray(settings.hooks[event]), `${event} hook should be installed`);
  assert.ok(
    settings.hooks[event].some((entry) =>
      Array.isArray(entry.hooks) && entry.hooks.some((hook) => String(hook.command).includes(`te guard claude-code hook --event ${event}`))
    ),
    `${event} hook should call te guard`
  );
}
for (const event of ["SessionStart", "PreToolUse", "PostToolUse"]) {
  for (const entry of settings.hooks[event]) {
    for (const hook of entry.hooks || []) {
      if (String(hook.command).includes("guard claude-code hook")) {
        hook.command = `"${process.execPath}" "${cli}" guard claude-code hook --event ${event} --mode observe`;
      }
    }
  }
}
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600 });

const doctor = JSON.parse(run(["guard", "claude-code", "doctor", "--project", project, "--json"]));
assert.equal(doctor.ok, true, "doctor should pass with installed hooks");
assert.equal(doctor.project_dir, project);
assert.equal(doctor.settings_path, settingsPath);
assert.ok(doctor.checks.some((check) => check.check === "Wrong sibling folder detected" && check.level === "warn"));
assert.ok(doctor.checks.some((check) => check.check === "Recent hook delivery" && check.level === "warn"));

const fakeApi = await startFakeApi();
try {
  const probe = JSON.parse(await runAsync(
    ["guard", "claude-code", "doctor", "--project", project, "--probe", "--json"],
    { apiUrl: fakeApi.apiUrl }
  ));
  assert.equal(probe.ok, true, "probe should pass against fake API");
  assert.equal(probe.probe.commands.length, 3);
  assert.ok(probe.probe.commands.every((command) => command.ok), "each installed hook command should execute");
  assert.equal(probe.probe.server.ok, true, "server trace should include probe events");
  const statusLog = path.join(project, ".claude", "tuning-engines-hook-status.jsonl");
  assert.ok(fs.existsSync(statusLog), "hook status log should be written");
  const statusRows = fs.readFileSync(statusLog, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.ok(statusRows.some((row) => row.event === "PostToolUse" && row.upload_status === "uploaded" && row.probe === true));
} finally {
  await fakeApi.close();
}

const nestedClaudeProject = path.join(tmp, "nested", ".claude");
fs.mkdirSync(nestedClaudeProject, { recursive: true });
const nestedOutput = run(["guard", "claude-code", "install", "--project", nestedClaudeProject, "--mode", "observe"]);
assert.match(nestedOutput, /using its parent project directory/);
assert.ok(fs.existsSync(path.join(tmp, "nested", ".claude", "settings.local.json")), "--project .claude should still write inside that .claude folder via parent resolution");

const brokenProject = path.join(tmp, "broken");
fs.mkdirSync(`${brokenProject}.claude`, { recursive: true });
let failed = false;
try {
  run(["guard", "claude-code", "doctor", "--project", brokenProject, "--json"]);
} catch (err) {
  failed = true;
  const payload = JSON.parse(err.stdout.toString());
  assert.equal(payload.ok, false);
  assert.ok(payload.checks.some((check) => check.level === "fail" && check.check === "Project .claude folder"));
}
assert.equal(failed, true, "doctor should fail when only sibling project.claude exists");

console.log("Claude Code guard install tests passed");
