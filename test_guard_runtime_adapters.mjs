import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const cli = path.join(process.cwd(), "dist", "cli.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "te-runtime-adapters-"));

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
  const requests = [];
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "POST" && url.pathname === "/api/v1/auth/token") {
        await readRequestJson(req).catch(() => ({}));
        json(res, 200, { access_token: "access-token", expires_in: 900 });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/v1/traces") {
        const body = await readRequestJson(req);
        requests.push(body);
        const runId = body.run_id;
        const existing = traces.get(runId) || { run_id: runId, request_id: body.request_id, events: [], metadata: {} };
        existing.events.push(...(Array.isArray(body.events) ? body.events : []));
        existing.metadata = { ...existing.metadata, ...(body.metadata || {}) };
        traces.set(runId, existing);
        json(res, 200, { ok: true, run_id: runId });
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
    requests,
    close: () => new Promise((resolve) => {
      if (typeof server.closeAllConnections === "function") server.closeAllConnections();
      server.close(resolve);
    }),
  };
}

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      TE_API_KEY: options.apiKey ?? "sk-te-runtime-adapter-test-token",
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

function runHook(args, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        TE_API_KEY: options.apiKey ?? "sk-te-runtime-adapter-test-token",
        TE_API_URL: options.apiUrl ?? process.env.TE_API_URL,
        PATH: options.path ?? process.env.PATH,
        HOME: options.home ?? tmp,
        ...(options.env || {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
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
    child.stdin.end(JSON.stringify(payload));
  });
}

function lastEvent(api) {
  const request = api.requests.at(-1);
  assert.ok(request, "expected trace request");
  assert.equal(request.events.length, 1);
  return request.events[0];
}

const api = await startFakeApi();
try {
  const sessionRequestCount = api.requests.length;
  await runHook(["guard", "codex", "hook", "--event", "SessionStart"], {
    session_id: "native-session-turns",
    cwd: tmp,
    source: "startup",
  }, { apiUrl: api.apiUrl });
  assert.equal(api.requests.length, sessionRequestCount, "SessionStart must not create an extra process-lifetime trace");

  await runHook(["guard", "codex", "hook", "--event", "UserPromptSubmit"], {
    session_id: "native-session-turns",
    turn_id: "native-turn-1",
    cwd: tmp,
    prompt: "Read the project README",
  }, { apiUrl: api.apiUrl, env: { TE_RUN_ID: "run_sidecar_stale", TE_REQUEST_ID: "req_sidecar_stale" } });
  const firstPromptRequest = api.requests.at(-1);
  assert.match(firstPromptRequest.run_id, /^run_codex_/);
  assert.match(firstPromptRequest.request_id, /^req_codex_/);
  assert.notEqual(firstPromptRequest.run_id, "run_sidecar_stale");

  await runHook(["guard", "codex", "hook", "--event", "PreToolUse"], {
    session_id: "native-session-turns",
    turn_id: "native-turn-1",
    cwd: tmp,
    tool_name: "Read",
    tool_use_id: "tool-native-read-1",
    tool_input: { path: path.join(tmp, "README.md"), content: "must not appear" },
  }, { apiUrl: api.apiUrl });
  const firstTurnTool = lastEvent(api);
  assert.equal(api.requests.at(-1).run_id, firstPromptRequest.run_id);
  assert.equal(firstTurnTool.metadata.tool_call_id, "tool-native-read-1");
  assert.equal(firstTurnTool.metadata.human_summary, "Read README.md");
  assert.equal(firstTurnTool.metadata.native_event_contract_version, "te-native-event-v2");
  assert.match(firstTurnTool.metadata.cli_version, /^0\./);
  assert.match(firstTurnTool.metadata.resolved_hook_command_path, /dist[\\/]cli\.js$/);
  assert.equal(firstTurnTool.metadata.tool_input, undefined);
  assert.equal(firstTurnTool.metadata.tool_response, undefined);
  assert.doesNotMatch(firstTurnTool.metadata.human_summary, /must not appear/);

  await runHook(["guard", "codex", "hook", "--event", "SubagentStart"], {
    session_id: "native-session-turns",
    turn_id: "native-turn-1",
    cwd: tmp,
    agent_id: "agent-read-package",
    agent_type: "read_package",
  }, { apiUrl: api.apiUrl });
  const subagentStarted = lastEvent(api);
  assert.equal(subagentStarted.metadata.human_summary, "Started subagent: read_package");

  await runHook(["guard", "codex", "hook", "--event", "SubagentStop"], {
    session_id: "native-session-turns",
    turn_id: "native-turn-1",
    cwd: tmp,
    agent_id: "agent-read-package",
    agent_type: "read_package",
    last_assistant_message: "package name found",
  }, { apiUrl: api.apiUrl });
  const subagentFinished = lastEvent(api);
  assert.equal(subagentFinished.metadata.human_summary, "Subagent finished: package name found");
  assert.equal(subagentFinished.parent_id, subagentStarted.id);

  await runHook(["guard", "codex", "hook", "--event", "Stop"], {
    session_id: "native-session-turns",
    turn_id: "native-turn-1",
    cwd: tmp,
    last_assistant_message: "README review complete.",
  }, { apiUrl: api.apiUrl });
  const firstStopRequest = api.requests.at(-1);
  assert.equal(firstStopRequest.run_id, firstPromptRequest.run_id);
  assert.equal(firstStopRequest.status, "succeeded");
  assert.ok(firstStopRequest.ended_at);
  assert.equal(lastEvent(api).metadata.final_response, "README review complete.");

  await runHook(["guard", "codex", "hook", "--event", "UserPromptSubmit"], {
    session_id: "native-session-turns",
    turn_id: "native-turn-2",
    cwd: tmp,
    prompt: "Create a test file",
  }, { apiUrl: api.apiUrl });
  const secondPromptRequest = api.requests.at(-1);
  assert.notEqual(secondPromptRequest.run_id, firstPromptRequest.run_id, "each native turn must create a fresh trace");
  assert.equal(secondPromptRequest.metadata.session_id, firstPromptRequest.metadata.session_id, "turn traces must share one Work Session identity");

  await runHook(["guard", "codex", "hook", "--event", "SessionEnd"], {
    session_id: "native-session-turns",
    cwd: tmp,
    reason: "other",
  }, { apiUrl: api.apiUrl });
  const sessionEndRequest = api.requests.at(-1);
  assert.equal(sessionEndRequest.run_id, secondPromptRequest.run_id, "SessionEnd should finalize the active turn");
  assert.equal(sessionEndRequest.status, "succeeded");
  assert.equal(sessionEndRequest.metadata.workflow_status, "completed");
  assert.equal(sessionEndRequest.metadata.outcome_result_status, "succeeded");

  const common = {
    session_id: "native-session-1",
    turn_id: "turn-1",
    cwd: tmp,
    tool_name: "Bash",
    tool_use_id: "tool-failed-bash",
    tool_input: { summary: "run failing shell command", command: "false && echo sk-te-secret-would-leak", ciphertext: "gAAAAvery-long-encrypted-looking-payload" },
  };

  await runHook(["guard", "codex", "hook", "--event", "PreToolUse"], common, { apiUrl: api.apiUrl });
  const proposed = lastEvent(api);
  assert.equal(proposed.type, "agent.tool_call");
  assert.equal(proposed.status, "proposed");
  assert.equal(proposed.metadata.phase, "proposed");
  assert.ok(proposed.metadata.tool_call_id, "proposed event should include stable tool_call_id");
  assert.doesNotMatch(JSON.stringify(proposed), /sk-te-secret-would-leak/);
  assert.doesNotMatch(proposed.metadata.human_summary, /false|gAAAA|\{/);

  await runHook(["guard", "codex", "hook", "--event", "PostToolUse"], {
    ...common,
    result: { exit_code: 1, error: "command failed with sk-te-secret-would-leak" },
  }, { apiUrl: api.apiUrl });
  const failedBash = lastEvent(api);
  assert.equal(failedBash.type, "agent.tool_call");
  assert.equal(failedBash.status, "failed");
  assert.equal(failedBash.metadata.phase, "failed");
  assert.equal(failedBash.metadata.exit_code, 1);
  assert.equal(failedBash.metadata.success, false);
  assert.equal(failedBash.metadata.ok, false);
  assert.equal(failedBash.metadata.tool_call_id, proposed.metadata.tool_call_id, "completion must reuse proposal tool_call_id");
  assert.equal(failedBash.parent_id, proposed.id, "completion should parent to the proposal event");
  assert.equal(failedBash.metadata.tool_input, undefined);
  assert.equal(failedBash.metadata.tool_response, undefined);
  assert.doesNotMatch(JSON.stringify(failedBash), /sk-te-secret-would-leak/);

  await runHook(["guard", "codex", "hook", "--event", "PostToolUse"], {
    session_id: "native-session-1",
    turn_id: "turn-2",
    cwd: tmp,
    tool_name: "ApplyPatch",
    tool_input: { summary: "apply README patch" },
    tool_response: { ok: false, error: "patch rejected" },
  }, { apiUrl: api.apiUrl });
  const failedPatch = lastEvent(api);
  assert.equal(failedPatch.status, "failed");
  assert.equal(failedPatch.metadata.phase, "failed");
  assert.equal(failedPatch.metadata.error, "patch rejected");

  await runHook(["guard", "codex", "hook", "--event", "PermissionRequest"], {
    session_id: "native-session-approval",
    cwd: tmp,
    tool_name: "Bash",
    tool_input: { summary: "restart service" },
  }, { apiUrl: api.apiUrl });
  const permissionRequest = lastEvent(api);
  assert.equal(permissionRequest.type, "approval.requested");
  assert.equal(permissionRequest.status, "proposed");
  assert.equal(permissionRequest.metadata.phase, "proposed");

  const codexProject = path.join(tmp, "codex-project");
  run(["guard", "codex", "install", "--project", codexProject], { apiUrl: api.apiUrl });
  const codexHooks = JSON.parse(fs.readFileSync(path.join(codexProject, ".codex", "hooks.json"), "utf8")).hooks;
  for (const event of ["PermissionRequest", "SessionEnd", "PreCompact", "PostCompact"]) {
    assert.ok(Array.isArray(codexHooks[event]), `${event} hook should be installed for Codex`);
  }
  const codexHookCommand = codexHooks.UserPromptSubmit[0].hooks[0].command;
  assert.match(codexHookCommand, new RegExp(process.execPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(codexHookCommand, /dist[\\/]cli\.js/);
  assert.doesNotMatch(codexHookCommand, /^te\s/);
  assert.match(
    run(["guard", "codex", "doctor", "--project", codexProject], { apiUrl: api.apiUrl }),
    /\[OK\] Pinned hook entrypoint/
  );

  const claudeProject = path.join(tmp, "claude-project");
  run(["guard", "claude-code", "install", "--project", claudeProject, "--mode", "observe"], { apiUrl: api.apiUrl });
  const claudeHooks = JSON.parse(fs.readFileSync(path.join(claudeProject, ".claude", "settings.local.json"), "utf8")).hooks;
  assert.ok(Array.isArray(claudeHooks.PermissionRequest), "Claude PermissionRequest hook should be installed");
  assert.match(claudeHooks.UserPromptSubmit[0].hooks[0].command, /dist[\\/]cli\.js/);
  assert.match(
    run(["guard", "claude-code", "doctor", "--project", claudeProject], { apiUrl: api.apiUrl }),
    /\[OK\] Required TE hooks/
  );

  await runHook(["guard", "claude-code", "hook", "--event", "SessionStart", "--mode", "observe"], {
    session_id: "claude-native-turns",
    cwd: tmp,
  }, { apiUrl: api.apiUrl });
  await runHook(["guard", "claude-code", "hook", "--event", "UserPromptSubmit", "--mode", "observe"], {
    session_id: "claude-native-turns",
    cwd: tmp,
    prompt: "Inspect the README",
  }, { apiUrl: api.apiUrl });
  const claudeFirstPrompt = api.requests.at(-1);
  assert.match(claudeFirstPrompt.run_id, /^run_claude_code_/);
  await runHook(["guard", "claude-code", "hook", "--event", "PreToolUse", "--mode", "observe"], {
    session_id: "claude-native-turns",
    cwd: tmp,
    tool_name: "Read",
    tool_use_id: "claude-read-1",
    tool_input: { path: "README.md" },
  }, { apiUrl: api.apiUrl });
  assert.equal(api.requests.at(-1).run_id, claudeFirstPrompt.run_id);
  await runHook(["guard", "claude-code", "hook", "--event", "UserPromptSubmit", "--mode", "observe"], {
    session_id: "claude-native-turns",
    cwd: tmp,
    prompt: "Inspect package metadata",
  }, { apiUrl: api.apiUrl });
  const claudeSecondPrompt = api.requests.at(-1);
  assert.notEqual(claudeSecondPrompt.run_id, claudeFirstPrompt.run_id);
  assert.equal(claudeSecondPrompt.metadata.session_id, claudeFirstPrompt.metadata.session_id);
  await runHook(["guard", "claude-code", "hook", "--event", "SessionEnd", "--mode", "observe"], {
    session_id: "claude-native-turns",
    cwd: tmp,
    last_assistant_message: "Package metadata review complete.",
  }, { apiUrl: api.apiUrl });
  const claudeSessionEnd = api.requests.at(-1);
  assert.equal(claudeSessionEnd.run_id, claudeSecondPrompt.run_id);
  assert.equal(claudeSessionEnd.status, "succeeded");
  assert.equal(lastEvent(api).metadata.final_response, "Package metadata review complete.");

  await runHook(["guard", "claude-code", "hook", "--event", "PermissionDenied", "--mode", "observe"], {
    session_id: "claude-denied",
    cwd: tmp,
    tool_name: "Bash",
    tool_input: { summary: "dangerous command" },
  }, { apiUrl: api.apiUrl });
  const claudeDenied = lastEvent(api);
  assert.equal(claudeDenied.type, "approval.denied");
  assert.equal(claudeDenied.status, "blocked");
  assert.equal(claudeDenied.metadata.phase, "blocked");

  const opencodeProject = path.join(tmp, "opencode-project");
  run(["guard", "opencode", "install", "--project", opencodeProject], { apiUrl: api.apiUrl });
  const opencodeConfig = JSON.parse(fs.readFileSync(path.join(opencodeProject, "opencode.json"), "utf8"));
  assert.deepEqual(opencodeConfig.plugin, ["./.opencode/plugins/tuning-engines.js"]);
  const pluginSource = fs.readFileSync(path.join(opencodeProject, ".opencode", "plugins", "tuning-engines.js"), "utf8");
  assert.match(pluginSource, /tool\.execute\.before/);
  assert.match(pluginSource, /permission\.asked/);
  assert.doesNotMatch(pluginSource, /opencode-helicone-session/);

  await runHook(["guard", "opencode", "hook", "--event", "tool.execute.before"], {
    session_id: "opencode-session",
    turn_id: "turn-1",
    cwd: tmp,
    tool: { name: "shell", arguments: { summary: "run tests" } },
  }, { apiUrl: api.apiUrl });
  const opencodeBefore = lastEvent(api);
  assert.equal(opencodeBefore.type, "agent.tool_call");
  assert.equal(opencodeBefore.status, "proposed");

  await runHook(["guard", "opencode", "hook", "--event", "tool.execute.after"], {
    session_id: "opencode-session",
    turn_id: "turn-1",
    cwd: tmp,
    tool: { name: "shell", arguments: { summary: "run tests" } },
    response: { ok: false, error: "test failed" },
  }, { apiUrl: api.apiUrl });
  const opencodeAfter = lastEvent(api);
  assert.equal(opencodeAfter.type, "agent.tool_call");
  assert.equal(opencodeAfter.status, "failed");
  assert.equal(opencodeAfter.metadata.phase, "failed");
  assert.equal(opencodeAfter.metadata.tool_call_id, opencodeBefore.metadata.tool_call_id);
  assert.equal(opencodeAfter.parent_id, opencodeBefore.id);

  await runHook(["guard", "opencode", "hook", "--event", "approval.denied"], {
    session_id: "opencode-approval",
    cwd: tmp,
    tool_name: "shell",
    granted: false,
  }, { apiUrl: api.apiUrl });
  const opencodeDenied = lastEvent(api);
  assert.equal(opencodeDenied.type, "approval.denied");
  assert.equal(opencodeDenied.status, "blocked");
} finally {
  await api.close();
}

console.log("Runtime adapter guard tests passed");
