import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { spawn } from "child_process";
import { TuningEnginesClient } from "../client";
import * as output from "../output";
import { goalMetadata, loadGoalContext } from "../goal_context";

type HookMode = "enforce" | "observe";

const HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "UserPromptExpansion",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SubagentStart",
  "Stop",
  "SubagentStop",
];
const CLINE_HOOK_EVENTS = ["TaskStart", "TaskResume", "TaskCancel", "TaskComplete", "PreToolUse", "PostToolUse", "UserPromptSubmit", "PreCompact"];
const CODEX_HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "SubagentStart", "SubagentStop"];

const SECRET_PATTERNS = [
  /\bsk-te-[A-Za-z0-9_\-]{16,}\b/g,
  /\bsk-[A-Za-z0-9_\-]{8,}\b/g,
  /\bte_[A-Za-z0-9_\-]{16,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"'\s,}]+/gi,
];

function sha(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJsonFile(filePath: string): Record<string, any> {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJsonFile(filePath: string, data: Record<string, any>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
}

function hookCommand(event: string, mode: HookMode, failOpen: boolean): string {
  const pieces = ["te", "guard", "claude-code", "hook", "--event", event, "--mode", mode];
  if (failOpen) pieces.push("--fail-open");
  return pieces.join(" ");
}

function codexHookCommand(event: string): string {
  return ["te", "guard", "codex", "hook", "--event", event].join(" ");
}

function removeExistingGuardHooks(hooks: any): void {
  for (const event of Object.keys(hooks || {})) {
    hooks[event] = Array.isArray(hooks[event])
      ? hooks[event]
          .map((entry: any) => ({
            ...entry,
            hooks: Array.isArray(entry.hooks)
              ? entry.hooks.filter((hook: any) => !String(hook.command || "").includes("te guard claude-code hook"))
              : entry.hooks,
          }))
          .filter((entry: any) => !Array.isArray(entry.hooks) || entry.hooks.length > 0)
      : hooks[event];
    if (Array.isArray(hooks[event]) && hooks[event].length === 0) delete hooks[event];
  }
}

function installHook(settings: Record<string, any>, event: string, mode: HookMode, failOpen: boolean): void {
  settings.hooks ||= {};
  settings.hooks[event] ||= [];
  const entry: Record<string, any> = {
    hooks: [{ type: "command", command: hookCommand(event, mode, failOpen) }],
  };
  if (event === "PreToolUse" || event === "PostToolUse") entry.matcher = "*";
  settings.hooks[event].push(entry);
}

function removeExistingCodexHooks(hooks: any): void {
  for (const event of Object.keys(hooks || {})) {
    hooks[event] = Array.isArray(hooks[event])
      ? hooks[event]
          .map((entry: any) => ({
            ...entry,
            hooks: Array.isArray(entry.hooks)
              ? entry.hooks.filter((hook: any) => !String(hook.command || "").includes("te guard codex hook"))
              : entry.hooks,
          }))
          .filter((entry: any) => !Array.isArray(entry.hooks) || entry.hooks.length > 0)
      : hooks[event];
    if (Array.isArray(hooks[event]) && hooks[event].length === 0) delete hooks[event];
  }
}

function installCodexHook(settings: Record<string, any>, event: string): void {
  settings.hooks ||= {};
  settings.hooks[event] ||= [];
  const entry: Record<string, any> = {
    hooks: [{ type: "command", command: codexHookCommand(event), statusMessage: "Recording Tuning Engines telemetry" }],
  };
  if (event === "PreToolUse" || event === "PostToolUse") entry.matcher = "*";
  settings.hooks[event].push(entry);
}

function compact(value: any, depth = 0): any {
  if (depth > 5) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redact(value).slice(0, 1200);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => compact(item, depth + 1));

  const result: Record<string, any> = {};
  for (const [key, raw] of Object.entries(value).slice(0, 80)) {
    if (/api[_-]?key|secret|token|password|authorization|credential/i.test(key)) {
      result[key] = "[FILTERED]";
    } else {
      result[key] = compact(raw, depth + 1);
    }
  }
  return result;
}

function redact(value: string): string {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[FILTERED]"), value);
}

function redactForOutput(value: any): any {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map((entry) => redactForOutput(entry));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, redactForOutput(entry)])
  );
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function safeJsonParse(value: string): Record<string, any> {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function hookEvent(input: Record<string, any>, explicitEvent?: string): string {
  return explicitEvent || input.hook_event_name || input.event || input.hook_event || "AgentAction";
}

function sessionId(input: Record<string, any>): string {
  return String(input.session_id || input.conversation_id || input.taskId || input.task_id || input.transcript_path || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

function safeSessionId(input: Record<string, any>): string {
  return sha(sessionId(input));
}

function runtimeSlug(runtime: string): string {
  return runtime.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function runIdFor(input: Record<string, any>, runtime = "claude_code"): string {
  return `run_${runtimeSlug(runtime)}_${sha(sessionId(input)).slice(0, 24)}`;
}

function requestIdFor(input: Record<string, any>, runtime = "claude_code"): string {
  return `req_${runtimeSlug(runtime)}_${sha(sessionId(input)).slice(0, 24)}`;
}

function toolName(input: Record<string, any>): string | undefined {
  return input.tool_name || input.name || input.tool?.name || input.preToolUse?.toolName || input.postToolUse?.toolName;
}

function toolInput(input: Record<string, any>): any {
  return input.tool_input || input.input || input.arguments || input.tool?.input || {};
}

function toolResponse(input: Record<string, any>): any {
  return input.tool_response || input.output || input.response || input.result || {};
}

function eventType(event: string): string {
  if (event === "UserPromptSubmit") return "agent.message";
  if (event === "SessionEnd" || event === "Stop" || event === "SubagentStop" || event === "AfterTask") return "action.finalized";
  if (event === "PreToolUse" || event === "PostToolUse" || event === "PostToolUseFailure") return "agent.tool_call";
  if (event === "SessionStart" || event === "UserPromptExpansion" || event === "AfterAgent") return "workflow.step";
  if (event === "SubagentStart") return "agent.message";
  return "custom.claude_code";
}

function eventStatus(event: string, decision?: any): string {
  if (decision && decision.allowed === false) return "blocked";
  if (event === "PreToolUse") return "proposed";
  if (event === "PostToolUseFailure") return "failed";
  if (event === "PostToolUse") return "succeeded";
  if (event === "SessionEnd" || event === "Stop" || event === "SubagentStop" || event === "AfterTask") return "succeeded";
  return "started";
}

function promptSummary(input: Record<string, any>): string | undefined {
  const value = input.prompt || input.user_prompt || input.expansion || input.command;
  return value ? redact(String(value)).slice(0, 240) : undefined;
}

function workspaceMetadata(input: Record<string, any>): Record<string, string> {
  const rawWorkspace = String(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const rawTranscript = input.transcript_path ? String(input.transcript_path) : undefined;
  return {
    workspace: path.basename(rawWorkspace),
    workspace_hash: sha(rawWorkspace),
    ...(rawTranscript ? { transcript_path_hash: sha(rawTranscript) } : {}),
  };
}

function normalizedGoalKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:\- ]+/g, "")
    .replace(/ +/g, "_")
    .slice(0, 120);
}

function nativeGoalMetadata(input: Record<string, any>, event: string, runtime: string): Record<string, string> {
  if (runtime !== "codex" || event !== "UserPromptSubmit") return {};
  const prompt = promptSummary(input)?.trim() || "";
  const match = prompt.match(/^\/goal(?:\s+|$)(.+)?$/i);
  const title = match?.[1]?.trim().replace(/^["']|["']$/g, "").slice(0, 400);
  if (!title) return {};

  return {
    goal_lifecycle: "declared",
    goal_text: title,
    goal_key: normalizedGoalKey(title),
    native_goal_iteration_hash: sha(`${safeSessionId(input)}:goal:${title}`),
  };
}

function sidecarRunIds(runtime: string, command: string[]): { requestId: string; runId: string; sessionId: string } {
  const seed = [runtime, command.join(" "), process.cwd(), Date.now(), process.pid].join(":");
  const suffix = sha(seed).slice(0, 24);
  return {
    requestId: `req_sidecar_${suffix}`,
    runId: `run_sidecar_${suffix}`,
    sessionId: `sidecar_${suffix}`,
  };
}

function upsertHeader(headers: string[], name: string, value?: string): void {
  if (!value) return;
  const prefix = `${name.toLowerCase()}:`;
  const index = headers.findIndex((header) => header.toLowerCase().startsWith(prefix));
  const next = `${name}: ${value}`;
  if (index === -1) headers.push(next);
  else headers[index] = next;
}

function observedCommandEnv(
  runtime: string,
  ids: { requestId: string; runId: string; sessionId: string },
  activeGoal: ReturnType<typeof loadGoalContext>
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TE_REQUEST_ID: ids.requestId,
    TE_RUN_ID: ids.runId,
    TE_TELEMETRY_SOURCE: "sidecar",
    TE_WORK_ITEM_ID: activeGoal?.work_item_id,
    TE_OUTCOME_CONTEXT_ID: activeGoal?.outcome_context_id,
    TE_OUTCOME_KEY: activeGoal?.outcome_key || activeGoal?.goal_key,
    TE_GOAL_KEY: activeGoal?.outcome_key || activeGoal?.goal_key,
  };

  if (runtime === "claude_code") {
    const headers = String(env.ANTHROPIC_CUSTOM_HEADERS || "")
      .split(/\r?\n/)
      .map((header) => header.trim())
      .filter(Boolean);
    upsertHeader(headers, "X-TE-Request-ID", ids.requestId);
    upsertHeader(headers, "X-TE-Run-ID", ids.runId);
    upsertHeader(headers, "X-TE-Work-Item-ID", activeGoal?.work_item_id);
    upsertHeader(headers, "X-TE-Outcome-Key", activeGoal?.outcome_key || activeGoal?.goal_key);
    upsertHeader(headers, "X-TE-Outcome-Context-ID", activeGoal?.outcome_context_id);
    upsertHeader(headers, "X-TE-Goal-Key", activeGoal?.outcome_key || activeGoal?.goal_key);
    upsertHeader(headers, "X-TE-Native-Source", runtime);
    upsertHeader(headers, "X-TE-Native-Session-ID", ids.sessionId);
    env.ANTHROPIC_CUSTOM_HEADERS = headers.join("\n");
  }

  return env;
}

function installClaudeGoalCommand(projectDir: string): string {
  const commandPath = path.join(projectDir, ".claude", "commands", "te-goal.md");
  fs.mkdirSync(path.dirname(commandPath), { recursive: true });
  fs.writeFileSync(commandPath, [
    "# Tuning Engines outcome label",
    "",
    "Use the terminal command below to label the desired outcome for this project:",
    "",
    "```bash",
    "te goal start \"$ARGUMENTS\"",
    "```",
    "",
    "When the work is finished, record the observed result with `te goal complete --result succeeded`.",
    "",
  ].join("\n"), { mode: 0o600 });
  return commandPath;
}

function installOpenCode(projectDir: string): string[] {
  const configPath = path.join(projectDir, "opencode.json");
  const config = readJsonFile(configPath);
  config.$schema ||= "https://opencode.ai/config.json";
  config.plugin = Array(config.plugin || []);
  if (!config.plugin.includes("opencode-helicone-session")) config.plugin.push("opencode-helicone-session");
  writeJsonFile(configPath, config);

  const commandPath = path.join(projectDir, ".opencode", "commands", "te-goal.md");
  fs.mkdirSync(path.dirname(commandPath), { recursive: true });
  fs.writeFileSync(commandPath, "---\ndescription: Label the desired Tuning Engines outcome\n---\n\nRun `te goal start \"$ARGUMENTS\"` in the project terminal, then continue the work. Record the result with `te goal complete --result succeeded` when finished.\n", { mode: 0o600 });
  return [configPath, commandPath];
}

function installCline(projectDir: string): string[] {
  const hookDir = path.join(projectDir, ".clinerules", "hooks");
  fs.mkdirSync(hookDir, { recursive: true });
  return CLINE_HOOK_EVENTS.map((event) => {
    const hookPath = path.join(hookDir, event);
    fs.writeFileSync(hookPath, `#!/bin/bash\nte guard cline hook --event ${event}\necho '{"cancel":false}'\n`, { mode: 0o755 });
    fs.chmodSync(hookPath, 0o755);
    return hookPath;
  });
}

function spawnObservedCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        console.error(`Observed command ended with signal ${signal}`);
        resolve(1);
      } else {
        resolve(code ?? 0);
      }
    });
  });
}

async function recordSidecarRun(
  client: TuningEnginesClient,
  runtime: string,
  command: string[],
  ids: { requestId: string; runId: string; sessionId: string },
  status: "running" | "succeeded" | "failed",
  eventStatusValue: "started" | "succeeded" | "failed",
  exitCode?: number
): Promise<void> {
  const now = new Date().toISOString();
  const goal = goalMetadata(undefined, ids.sessionId);
  const workspace = workspaceMetadata({});
  const safeCommand = redact(command.join(" ")).slice(0, 400);
  await client.createTrace({
    run_id: ids.runId,
    request_id: ids.requestId,
    name: `${traceRuntimeLabel(runtime)} - ${command[0] || "command"}`,
    runtime,
    telemetry_source: "sidecar",
    status,
    metadata: {
      request_id: ids.requestId,
      run_id: ids.runId,
      session_id: ids.sessionId,
      ...workspace,
      command: safeCommand,
      framework: runtime,
      source: "te_guard_run",
      telemetry_source: "sidecar",
      exit_code: exitCode,
      ...goal,
    },
    events: [
      {
        id: `evt_${sha([ids.runId, eventStatusValue].join(":")).slice(0, 24)}`,
        type: eventStatusValue === "started" ? "agent.message" : "action.finalized",
        status: eventStatusValue,
        at: now,
        metadata: compact({
          request_id: ids.requestId,
          run_id: ids.runId,
          session_id: ids.sessionId,
          runtime,
          source: "te_guard_run",
          telemetry_source: "sidecar",
          command: safeCommand,
          ...workspace,
          exit_code: exitCode,
          ...goal,
        }),
      },
    ],
  });
}

function traceRuntimeLabel(runtime: string): string {
  if (runtime === "codex") return "Codex";
  if (runtime === "claude_code") return "Claude Code";
  return runtime
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Sidecar";
}

async function recordTrace(client: TuningEnginesClient, input: Record<string, any>, event: string, decision?: any, runtime = "claude_code"): Promise<void> {
  const runId = runIdFor(input, runtime);
  const requestId = requestIdFor(input, runtime);
  const tool = toolName(input);
  const now = new Date().toISOString();
  const eventIdBase = [
    event,
    sessionId(input),
    input.tool_use_id || input.tool_call_id || tool || "",
    now,
  ].join(":");
  const goal = goalMetadata(input.cwd, sessionId(input));
  const nativeGoal = nativeGoalMetadata(input, event, runtime);
  const workspace = workspaceMetadata(input);

  await client.createTrace({
    run_id: runId,
    request_id: requestId,
    name: input.cwd ? `${traceRuntimeLabel(runtime)} - ${path.basename(String(input.cwd))}` : traceRuntimeLabel(runtime),
    runtime,
    telemetry_source: "sidecar",
    status: event === "Stop" || event === "SubagentStop" ? "succeeded" : "running",
    metadata: {
      request_id: requestId,
      run_id: runId,
      telemetry_source: "sidecar",
      session_id: safeSessionId(input),
      ...workspace,
      framework: runtime,
      source: `te_guard_${runtime}`,
      turn_id: input.turn_id,
      task_id: input.task_id,
      parent_task_id: input.parent_task_id,
      agent_id: input.agent_id,
      parent_agent_id: input.parent_agent_id,
      ...goal,
      ...nativeGoal,
    },
    events: [
      {
        id: `evt_${sha(eventIdBase).slice(0, 24)}`,
        type: eventType(event),
        status: eventStatus(event, decision),
        at: now,
        metadata: compact({
          request_id: requestId,
          run_id: runId,
          session_id: safeSessionId(input),
          hook_event: event,
          phase: event,
          name: tool || event,
          tool_name: tool,
          tool_input: event === "PostToolUse" ? undefined : toolInput(input),
          tool_response: event === "PostToolUse" ? toolResponse(input) : undefined,
          ...workspace,
          prompt_summary: promptSummary(input),
          turn_id: input.turn_id,
          task_id: input.task_id,
          parent_task_id: input.parent_task_id,
          agent_id: input.agent_id,
          parent_agent_id: input.parent_agent_id,
          decision,
          ...goal,
          ...nativeGoal,
        }),
      },
    ],
  });
}

async function evaluatePreToolUse(
  client: TuningEnginesClient,
  input: Record<string, any>,
  event: string,
  mode: HookMode
): Promise<any> {
  const result = await client.evaluateAgentAction({
    runtime: "claude_code",
    hook_event: event,
    phase: event,
    enforce: mode === "enforce",
    request_id: requestIdFor(input),
    run_id: runIdFor(input),
    session_id: safeSessionId(input),
    cwd: workspaceMetadata(input).workspace,
    tool_name: toolName(input),
    tool_input: compact(toolInput(input)),
    metadata: compact({
      source: "te_guard_claude_code",
      telemetry_source: "sidecar",
      tool_use_id: input.tool_use_id || input.tool_call_id,
      raw_hook_event: input.hook_event_name || input.event,
      ...workspaceMetadata(input),
    }),
  });
  return result.decision || result;
}

export function registerGuardCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const guard = program
    .command("guard")
    .description("Agent flight recorder and policy firewall commands");

  const claude = guard
    .command("claude-code")
    .description("Install and run Claude Code flight-recorder hooks");
  const codex = guard
    .command("codex")
    .description("Install and run Codex hook telemetry");
  const opencode = guard.command("opencode").description("Install OpenCode session tracking");
  const cline = guard.command("cline").description("Install and run Cline lifecycle hooks");

  guard
    .command("run")
    .description("Run a local agent command with sidecar lifecycle tracing")
    .option("--runtime <runtime>", "Runtime label, e.g. codex, anthropic_sdk, custom", "custom")
    .allowUnknownOption(true)
    .argument("[command...]", "Command to run after --")
    .action(async (commandParts: string[], opts) => {
      if (!commandParts.length) {
        console.error("Usage: te guard run --runtime codex -- codex");
        process.exit(1);
      }

      const runtime = String(opts.runtime || "custom");
      const [command, ...args] = commandParts;
      const ids = sidecarRunIds(runtime, commandParts);
      const client = getClient();
      const activeGoal = loadGoalContext();

      try {
        await recordSidecarRun(client, runtime, commandParts, ids, "running", "started");
      } catch (err: any) {
        console.error(`Tuning Engines guard warning: ${err.message}`);
      }

      let exitCode = 0;
      try {
        exitCode = await spawnObservedCommand(command, args, observedCommandEnv(runtime, ids, activeGoal));
      } catch (err: any) {
        console.error(`Observed command failed to start: ${err.message}`);
        exitCode = 127;
      }

      try {
        await recordSidecarRun(
          client,
          runtime,
          commandParts,
          ids,
          exitCode === 0 ? "succeeded" : "failed",
          exitCode === 0 ? "succeeded" : "failed",
          exitCode
        );
      } catch (err: any) {
        console.error(`Tuning Engines guard warning: ${err.message}`);
      }

      process.exit(exitCode);
    });

  claude
    .command("install")
    .description("Install Tuning Engines hooks into Claude Code settings")
    .option("--project <dir>", "Project directory", process.cwd())
    .option("--shared", "Write .claude/settings.json instead of .claude/settings.local.json")
    .option("--mode <mode>", "Hook mode: enforce or observe", "enforce")
    .option("--fail-open", "Allow tools if the guard API is unavailable")
    .option("--dry-run", "Print the resulting settings without writing")
    .option("--json", "Output as JSON")
    .action((opts) => {
      try {
        const mode = opts.mode === "observe" ? "observe" : "enforce";
        const settingsPath = path.join(
          path.resolve(opts.project),
          ".claude",
          opts.shared ? "settings.json" : "settings.local.json"
        );
        const settings = readJsonFile(settingsPath);
        settings.hooks ||= {};
        removeExistingGuardHooks(settings.hooks);
        for (const event of HOOK_EVENTS) installHook(settings, event, mode, Boolean(opts.failOpen));

        if (opts.dryRun || opts.json) {
          output.json({ path: settingsPath, settings: redactForOutput(settings) });
          return;
        }

        writeJsonFile(settingsPath, settings);
        const commandPath = installClaudeGoalCommand(path.resolve(opts.project));
        console.log(`Installed Claude Code guard hooks in ${settingsPath}`);
        console.log(`Installed /te-goal helper in ${commandPath}`);
        console.log(`Mode: ${mode}${opts.failOpen ? " (fail-open)" : " (fail-closed for PreToolUse)"}`);
        console.log("Run Claude Code from this project; actions will appear in Inference > Work Sessions.");
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  claude
    .command("hook")
    .description("Claude Code hook entrypoint. Reads hook JSON from stdin.")
    .option("--event <event>", "Claude Code hook event name")
    .option("--mode <mode>", "Hook mode: enforce or observe", "enforce")
    .option("--fail-open", "Allow tools if the guard API is unavailable")
    .action(async (opts) => {
      const mode: HookMode = opts.mode === "observe" ? "observe" : "enforce";
      const failOpen = Boolean(opts.failOpen);
      let input: Record<string, any> = {};
      let currentEvent = opts.event;

      try {
        input = safeJsonParse(await readStdin());
        const event = hookEvent(input, opts.event);
        currentEvent = event;
        const client = getClient();
        let decision: any;

        if (event === "PreToolUse") {
          decision = await evaluatePreToolUse(client, input, event, mode);
        }

        await recordTrace(client, input, event, decision);

        if (event === "PreToolUse" && decision?.allowed === false && mode === "enforce") {
          console.error(decision.message || decision.reason || "Blocked by Tuning Engines policy");
          process.exit(2);
        }
      } catch (err: any) {
        if (currentEvent === "PreToolUse" && mode === "enforce" && !failOpen) {
          console.error(`Tuning Engines guard unavailable: ${err.message}`);
          process.exit(2);
        }
        console.error(`Tuning Engines guard warning: ${err.message}`);
      }
    });

  codex
    .command("install")
    .description("Install Tuning Engines hooks into Codex settings")
    .option("--project <dir>", "Project directory", process.cwd())
    .option("--global", "Write ~/.codex/hooks.json instead of project-local .codex/hooks.json")
    .option("--dry-run", "Print the resulting settings without writing")
    .option("--json", "Output as JSON")
    .action((opts) => {
      try {
        const projectDir = path.resolve(opts.project);
        const settingsPath = opts.global
          ? path.join(process.env.HOME || process.cwd(), ".codex", "hooks.json")
          : path.join(projectDir, ".codex", "hooks.json");
        const settings = readJsonFile(settingsPath);
        settings.hooks ||= {};
        removeExistingCodexHooks(settings.hooks);
        for (const event of CODEX_HOOK_EVENTS) installCodexHook(settings, event);

        if (opts.dryRun || opts.json) {
          output.json({ path: settingsPath, settings: redactForOutput(settings) });
          return;
        }

        writeJsonFile(settingsPath, settings);
        console.log(`Installed Codex hooks in ${settingsPath}`);
        console.log("Review and trust the project hooks from Codex /hooks before relying on native goal telemetry.");
        console.log("Native /goal declarations will appear in Inference > Work Sessions > Diagnostics.");
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  codex
    .command("uninstall")
    .description("Remove Tuning Engines hooks from Codex settings")
    .option("--project <dir>", "Project directory", process.cwd())
    .option("--global", "Update ~/.codex/hooks.json instead of project-local .codex/hooks.json")
    .option("--dry-run", "Print the resulting settings without writing")
    .option("--json", "Output as JSON")
    .action((opts) => {
      try {
        const projectDir = path.resolve(opts.project);
        const settingsPath = opts.global
          ? path.join(process.env.HOME || process.cwd(), ".codex", "hooks.json")
          : path.join(projectDir, ".codex", "hooks.json");
        const settings = readJsonFile(settingsPath);
        settings.hooks ||= {};
        removeExistingCodexHooks(settings.hooks);

        if (opts.dryRun || opts.json) {
          output.json({ path: settingsPath, settings: redactForOutput(settings) });
          return;
        }

        writeJsonFile(settingsPath, settings);
        console.log(`Removed Tuning Engines Codex hooks from ${settingsPath}`);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  codex
    .command("hook")
    .description("Codex hook entrypoint. Reads hook JSON from stdin.")
    .option("--event <event>", "Codex hook event name")
    .action(async (opts) => {
      try {
        const input = safeJsonParse(await readStdin());
        await recordTrace(getClient(), input, hookEvent(input, opts.event), undefined, "codex");
      } catch (err: any) {
        console.error(`Tuning Engines Codex telemetry warning: ${err.message}`);
      }
    });

  opencode.command("install").description("Install OpenCode session tracking and /te-goal helper")
    .option("--project <dir>", "Project directory", process.cwd()).action((opts) => {
      try {
        const paths = installOpenCode(path.resolve(opts.project));
        console.log(`Installed OpenCode session tracking in ${paths.join(" and ")}`);
        console.log("OpenCode will load opencode-helicone-session on startup; TE recognizes its pseudonymous session header.");
      } catch (err: any) { console.error(err.message); process.exit(1); }
    });

  cline.command("install").description("Install Cline project hooks")
    .option("--project <dir>", "Project directory", process.cwd()).action((opts) => {
      try {
        const paths = installCline(path.resolve(opts.project));
        console.log(`Installed ${paths.length} Cline hooks in ${path.dirname(paths[0])}`);
        console.log("Enable project hooks in Cline; each task will appear as one Work Session.");
      } catch (err: any) { console.error(err.message); process.exit(1); }
    });

  cline.command("hook").description("Cline hook entrypoint. Reads hook JSON from stdin.")
    .option("--event <event>", "Cline hook event name").action(async (opts) => {
      try {
        const input = safeJsonParse(await readStdin());
        await recordTrace(getClient(), input, hookEvent(input, opts.event), undefined, "cline");
      } catch (err: any) {
        console.error(`Tuning Engines Cline telemetry warning: ${err.message}`);
      }
    });
}
