import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

type HookMode = "enforce" | "observe";

const HOOK_EVENTS = [
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SubagentStop",
];

const SECRET_PATTERNS = [
  /\bsk-te-[A-Za-z0-9_\-]{16,}\b/g,
  /\bsk-[A-Za-z0-9_\-]{8,}\b/g,
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
  return String(input.session_id || input.conversation_id || input.transcript_path || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

function runIdFor(input: Record<string, any>): string {
  return `run_claude_${sha(sessionId(input)).slice(0, 24)}`;
}

function requestIdFor(input: Record<string, any>): string {
  return `req_claude_${sha(sessionId(input)).slice(0, 24)}`;
}

function toolName(input: Record<string, any>): string | undefined {
  return input.tool_name || input.name || input.tool?.name;
}

function toolInput(input: Record<string, any>): any {
  return input.tool_input || input.input || input.arguments || input.tool?.input || {};
}

function toolResponse(input: Record<string, any>): any {
  return input.tool_response || input.output || input.response || input.result || {};
}

function eventType(event: string): string {
  if (event === "UserPromptSubmit") return "agent.message";
  if (event === "Stop" || event === "SubagentStop") return "action.finalized";
  if (event === "PreToolUse" || event === "PostToolUse") return "agent.tool_call";
  return "custom.claude_code";
}

function eventStatus(event: string, decision?: any): string {
  if (decision && decision.allowed === false) return "blocked";
  if (event === "PreToolUse") return "proposed";
  if (event === "PostToolUse") return "succeeded";
  if (event === "Stop" || event === "SubagentStop") return "succeeded";
  return "started";
}

async function recordTrace(client: TuningEnginesClient, input: Record<string, any>, event: string, decision?: any): Promise<void> {
  const runId = runIdFor(input);
  const requestId = requestIdFor(input);
  const tool = toolName(input);
  const now = new Date().toISOString();
  const eventIdBase = [
    event,
    sessionId(input),
    input.tool_use_id || input.tool_call_id || tool || "",
    now,
  ].join(":");

  await client.createTrace({
    run_id: runId,
    request_id: requestId,
    name: input.cwd ? `Claude Code - ${path.basename(String(input.cwd))}` : "Claude Code",
    runtime: "claude_code",
    status: event === "Stop" || event === "SubagentStop" ? "succeeded" : "running",
    metadata: {
      request_id: requestId,
      run_id: runId,
      session_id: sessionId(input),
      cwd: input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      transcript_path: input.transcript_path,
      framework: "claude_code",
      source: "te_guard_claude_code",
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
          session_id: sessionId(input),
          hook_event: event,
          phase: event,
          name: tool || event,
          tool_name: tool,
          tool_input: event === "PostToolUse" ? undefined : toolInput(input),
          tool_response: event === "PostToolUse" ? toolResponse(input) : undefined,
          cwd: input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(),
          transcript_path: input.transcript_path,
          decision,
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
    session_id: sessionId(input),
    cwd: input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    transcript_path: input.transcript_path,
    tool_name: toolName(input),
    tool_input: compact(toolInput(input)),
    metadata: compact({
      source: "te_guard_claude_code",
      tool_use_id: input.tool_use_id || input.tool_call_id,
      raw_hook_event: input.hook_event_name || input.event,
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
          output.json({ path: settingsPath, settings });
          return;
        }

        writeJsonFile(settingsPath, settings);
        console.log(`Installed Claude Code guard hooks in ${settingsPath}`);
        console.log(`Mode: ${mode}${opts.failOpen ? " (fail-open)" : " (fail-closed for PreToolUse)"}`);
        console.log("Run Claude Code from this project; actions will appear in Inference > Flight Recorder.");
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
}
