"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGuardCommands = registerGuardCommands;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
const output = __importStar(require("../output"));
const goal_context_1 = require("../goal_context");
const config_1 = require("../config");
const version_1 = require("../version");
const NATIVE_EVENT_CONTRACT_VERSION = "te-native-event-v1";
const HOOK_EVENTS = [
    "SessionStart",
    "SessionEnd",
    "UserPromptSubmit",
    "UserPromptExpansion",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "PostToolBatch",
    "PermissionDenied",
    "SubagentStart",
    "Stop",
    "StopFailure",
    "SubagentStop",
    "TaskCreated",
    "TaskCompleted",
];
const CLINE_HOOK_EVENTS = ["TaskStart", "TaskResume", "TaskCancel", "TaskComplete", "PreToolUse", "PostToolUse", "UserPromptSubmit", "PreCompact"];
const CODEX_HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "SubagentStart", "SubagentStop"];
const RICH_WRAPPER_RUNTIMES = new Set(["codex", "opencode", "aider", "continue", "zed", "custom"]);
const SECRET_PATTERNS = [
    /\bsk-te-[A-Za-z0-9_\-]{16,}\b/g,
    /\bsk-[A-Za-z0-9_\-]{8,}\b/g,
    /\bte_[A-Za-z0-9_\-]{16,}\b/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"'\s,}]+/gi,
];
function sha(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}
function readJsonFile(filePath) {
    if (!fs.existsSync(filePath))
        return {};
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
function writeJsonFile(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
}
function hookCommand(event, mode, failOpen) {
    const pieces = ["te", "guard", "claude-code", "hook", "--event", event, "--mode", mode];
    if (failOpen)
        pieces.push("--fail-open");
    return pieces.join(" ");
}
function claudeInstallModeSummary(mode, failOpen) {
    if (mode === "observe")
        return "observe (records activity only; tools will not be blocked)";
    return failOpen ? "enforce (fail-open)" : "enforce (fail-closed for PreToolUse)";
}
function codexHookCommand(event) {
    return ["te", "guard", "codex", "hook", "--event", event].join(" ");
}
function removeExistingGuardHooks(hooks) {
    for (const event of Object.keys(hooks || {})) {
        hooks[event] = Array.isArray(hooks[event])
            ? hooks[event]
                .map((entry) => ({
                ...entry,
                hooks: Array.isArray(entry.hooks)
                    ? entry.hooks.filter((hook) => !String(hook.command || "").includes("guard claude-code hook"))
                    : entry.hooks,
            }))
                .filter((entry) => !Array.isArray(entry.hooks) || entry.hooks.length > 0)
            : hooks[event];
        if (Array.isArray(hooks[event]) && hooks[event].length === 0)
            delete hooks[event];
    }
}
function installHook(settings, event, mode, failOpen) {
    settings.hooks ||= {};
    settings.hooks[event] ||= [];
    const entry = {
        hooks: [{ type: "command", command: hookCommand(event, mode, failOpen) }],
    };
    if (event === "PreToolUse" || event === "PostToolUse" || event === "PostToolUseFailure" || event === "PermissionDenied")
        entry.matcher = "*";
    settings.hooks[event].push(entry);
}
function removeExistingCodexHooks(hooks) {
    for (const event of Object.keys(hooks || {})) {
        hooks[event] = Array.isArray(hooks[event])
            ? hooks[event]
                .map((entry) => ({
                ...entry,
                hooks: Array.isArray(entry.hooks)
                    ? entry.hooks.filter((hook) => !String(hook.command || "").includes("te guard codex hook"))
                    : entry.hooks,
            }))
                .filter((entry) => !Array.isArray(entry.hooks) || entry.hooks.length > 0)
            : hooks[event];
        if (Array.isArray(hooks[event]) && hooks[event].length === 0)
            delete hooks[event];
    }
}
function installCodexHook(settings, event) {
    settings.hooks ||= {};
    settings.hooks[event] ||= [];
    const entry = {
        hooks: [{ type: "command", command: codexHookCommand(event), statusMessage: "Recording Tuning Engines telemetry" }],
    };
    if (event === "PreToolUse" || event === "PostToolUse")
        entry.matcher = "*";
    settings.hooks[event].push(entry);
}
function compact(value, depth = 0) {
    if (depth > 5)
        return "[TRUNCATED]";
    if (value === null || value === undefined)
        return value;
    if (typeof value === "string")
        return redact(value).slice(0, 1200);
    if (typeof value !== "object")
        return value;
    if (Array.isArray(value))
        return value.slice(0, 40).map((item) => compact(item, depth + 1));
    const result = {};
    for (const [key, raw] of Object.entries(value).slice(0, 80)) {
        if (/api[_-]?key|secret|token|password|authorization|credential/i.test(key)) {
            result[key] = "[FILTERED]";
        }
        else {
            result[key] = compact(raw, depth + 1);
        }
    }
    return result;
}
function redact(value) {
    return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[FILTERED]"), value);
}
function redactError(value) {
    return redact(String(value?.message || value || "unknown error")).slice(0, 500);
}
function redactForOutput(value) {
    if (typeof value === "string")
        return redact(value);
    if (Array.isArray(value))
        return value.map((entry) => redactForOutput(entry));
    if (!value || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactForOutput(entry)]));
}
function readStdin() {
    return new Promise((resolve, reject) => {
        let data = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => (data += chunk));
        process.stdin.on("end", () => resolve(data));
        process.stdin.on("error", reject);
    });
}
function safeJsonParse(value) {
    if (!value.trim())
        return {};
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}
function hookEvent(input, explicitEvent) {
    return explicitEvent || input.hook_event_name || input.event || input.hook_event || "AgentAction";
}
function firstPresent(...values) {
    const value = values.find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim() !== "");
    return value === undefined ? undefined : String(value);
}
function boundedId(value) {
    return value ? value.slice(0, 200) : undefined;
}
function sessionId(input) {
    return String(firstPresent(process.env.TE_NATIVE_SESSION_ID, process.env.TE_NATIVE_THREAD_ID, input.session_id, input.conversation_id, input.taskId, input.task_id, input.transcript_path, process.env.CLAUDE_PROJECT_DIR, process.cwd()));
}
function threadId(input) {
    return String(firstPresent(process.env.TE_NATIVE_THREAD_ID, process.env.TE_NATIVE_SESSION_ID, input.thread_id, input.conversation_id, input.session_id, input.taskId, input.task_id, process.env.CLAUDE_PROJECT_DIR, process.cwd()));
}
function eventInputId(input) {
    return input.event_id || input.hook_event_id || input.id || input.uuid || input.tool_use_id || input.tool_call_id || input.call_id || input.taskId || input.task_id || input.turn_id;
}
function safeSessionId(input) {
    return sha(sessionId(input));
}
function safeThreadId(input) {
    return sha(threadId(input));
}
function runtimeSlug(runtime) {
    return runtime.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function runIdFor(input, runtime = "claude_code") {
    const explicit = boundedId(firstPresent(input.run_id, input.te_run_id, process.env.TE_RUN_ID));
    if (explicit)
        return explicit;
    return `run_${runtimeSlug(runtime)}_${sha(sessionId(input)).slice(0, 24)}`;
}
function requestIdFor(input, runtime = "claude_code") {
    const explicit = boundedId(firstPresent(input.request_id, input.te_request_id, process.env.TE_REQUEST_ID));
    if (explicit)
        return explicit;
    return `req_${runtimeSlug(runtime)}_${sha(sessionId(input)).slice(0, 24)}`;
}
function toolName(input) {
    return input.tool_name || input.name || input.tool?.name || input.preToolUse?.toolName || input.postToolUse?.toolName;
}
function toolInput(input) {
    return input.tool_input || input.input || input.arguments || input.tool?.input || {};
}
function toolResponse(input) {
    return input.tool_response || input.output || input.response || input.result || {};
}
function eventType(event) {
    if (event === "UserPromptSubmit")
        return "agent.message";
    if (event === "SessionEnd" || event === "Stop" || event === "StopFailure" || event === "SubagentStop" || event === "AfterTask" || event === "TaskComplete" || event === "TaskCompleted" || event === "TaskCancel")
        return "action.finalized";
    if (event === "PreToolUse" || event === "PostToolUse" || event === "PostToolUseFailure")
        return "agent.tool_call";
    if (event === "SessionStart" || event === "TaskStart" || event === "TaskCreated" || event === "TaskResume" || event === "PostToolBatch" || event === "PermissionDenied" || event === "PreCompact" || event === "UserPromptExpansion" || event === "AfterAgent")
        return "workflow.step";
    if (event === "SubagentStart")
        return "agent.message";
    return "custom.claude_code";
}
function eventStatus(event, decision) {
    if (decision && decision.allowed === false)
        return "blocked";
    if (event === "PreToolUse")
        return "proposed";
    if (event === "PostToolUseFailure" || event === "StopFailure" || event === "TaskCancel")
        return "failed";
    if (event === "PostToolUse")
        return "succeeded";
    if (event === "SessionEnd" || event === "Stop" || event === "SubagentStop" || event === "AfterTask" || event === "TaskComplete" || event === "TaskCompleted" || event === "PostToolBatch")
        return "succeeded";
    return "started";
}
function toolExecutionPhase(event) {
    if (event === "PreToolUse")
        return "proposed";
    if (event === "PostToolUse")
        return "executed";
    if (event === "PostToolUseFailure")
        return "failed";
    return undefined;
}
function promptSummary(input) {
    const value = input.prompt || input.user_prompt || input.expansion || input.command;
    return value ? redact(String(value)).slice(0, 240) : undefined;
}
function workspaceMetadata(input) {
    const rawWorkspace = String(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
    const rawTranscript = input.transcript_path ? String(input.transcript_path) : undefined;
    return {
        workspace: path.basename(rawWorkspace),
        workspace_hash: sha(rawWorkspace),
        ...(rawTranscript ? { transcript_path_hash: sha(rawTranscript) } : {}),
    };
}
function modelEnvMetadata() {
    const primary = firstPresent(process.env.TE_MODEL, process.env.ANTHROPIC_MODEL, process.env.CLAUDE_MODEL, process.env.OPENAI_MODEL, process.env.OPENAI_API_MODEL, process.env.CODEX_MODEL, process.env.LLM_MODEL, process.env.MODEL);
    const smallFast = firstPresent(process.env.TE_SMALL_FAST_MODEL, process.env.ANTHROPIC_SMALL_FAST_MODEL, process.env.CLAUDE_SMALL_FAST_MODEL);
    return compact({
        model: primary ? redact(primary).slice(0, 160) : undefined,
        primary_model: primary ? redact(primary).slice(0, 160) : undefined,
        small_fast_model: smallFast ? redact(smallFast).slice(0, 160) : undefined,
        model_source: primary || smallFast ? "environment" : undefined,
    });
}
function traceparentMetadata(input) {
    const traceparent = input.traceparent || input.trace_parent || input.trace?.traceparent || process.env.TRACEPARENT;
    const tracestate = input.tracestate || input.trace_state || process.env.TRACESTATE;
    return {
        ...(traceparent ? { traceparent: String(traceparent) } : {}),
        ...(tracestate ? { tracestate: String(tracestate) } : {}),
    };
}
function normalizedGoalKey(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:\- ]+/g, "")
        .replace(/ +/g, "_")
        .slice(0, 120);
}
function nativeGoalMetadata(input, event, runtime) {
    if (runtime !== "codex" || event !== "UserPromptSubmit")
        return {};
    const prompt = promptSummary(input)?.trim() || "";
    const match = prompt.match(/^\/goal(?:\s+|$)(.+)?$/i);
    const title = match?.[1]?.trim().replace(/^["']|["']$/g, "").slice(0, 400);
    if (!title)
        return {};
    return {
        goal_lifecycle: "declared",
        goal_text: title,
        goal_key: normalizedGoalKey(title),
        native_goal_iteration_hash: sha(`${safeSessionId(input)}:goal:${title}`),
    };
}
function nativeTaskSeed(input, event, runtime) {
    const explicit = eventInputId(input);
    const tool = toolName(input);
    if (explicit)
        return `${runtime}:task:${explicit}`;
    if (event === "SessionStart")
        return `${runtime}:session:${sessionId(input)}:start`;
    if (event === "UserPromptSubmit" || event === "UserPromptExpansion")
        return `${runtime}:prompt:${sessionId(input)}:${promptSummary(input) || ""}`;
    if (event === "SubagentStart" || event === "SubagentStop")
        return `${runtime}:subagent:${sessionId(input)}:${input.agent_id || input.subagent_id || tool || event}`;
    if (event === "TaskStart" || event === "TaskCreated" || event === "TaskResume" || event === "TaskComplete" || event === "TaskCompleted" || event === "TaskCancel")
        return `${runtime}:task:${sessionId(input)}:${input.taskId || input.task_id || input.name || event}`;
    return `${runtime}:event:${sessionId(input)}:${event}:${tool || input.name || ""}:${input.timestamp || input.created_at || input.started_at || ""}`;
}
function nativeParentTaskSeed(input, event, runtime) {
    const explicitParent = input.parent_task_id || input.parentTaskId || input.parent_tool_use_id || input.parent_tool_call_id || input.parent_event_id || input.parent_id;
    if (explicitParent)
        return `${runtime}:task:${explicitParent}`;
    if (event === "SessionStart")
        return undefined;
    if (event === "PostToolUse" || event === "PostToolUseFailure")
        return nativeTaskSeed(input, "PreToolUse", runtime);
    if (event === "SubagentStop")
        return nativeTaskSeed(input, "SubagentStart", runtime);
    if (event === "TaskComplete" || event === "TaskCompleted" || event === "TaskCancel")
        return nativeTaskSeed(input, "TaskStart", runtime);
    return `${runtime}:session:${sessionId(input)}:start`;
}
function nativeEventId(input, event, runtime) {
    return `evt_${sha([runtime, nativeTaskSeed(input, event, runtime), event].join(":")).slice(0, 24)}`;
}
function nativeParentEventId(input, event, runtime) {
    if (input.parent_event_id || input.parent_id || input.parent_client_event_id) {
        return String(input.parent_event_id || input.parent_id || input.parent_client_event_id);
    }
    if (event === "SessionStart")
        return undefined;
    if (event === "PostToolUse" || event === "PostToolUseFailure")
        return nativeEventId(input, "PreToolUse", runtime);
    if (event === "SubagentStop")
        return nativeEventId(input, "SubagentStart", runtime);
    if (event === "TaskComplete" || event === "TaskCompleted" || event === "TaskCancel")
        return nativeEventId(input, "TaskStart", runtime);
    return nativeEventId(input, "SessionStart", runtime);
}
function nativeTaskId(input, event, runtime) {
    return `task_${sha(nativeTaskSeed(input, event, runtime)).slice(0, 24)}`;
}
function nativeParentTaskId(input, event, runtime) {
    const seed = nativeParentTaskSeed(input, event, runtime);
    return seed ? `task_${sha(seed).slice(0, 24)}` : undefined;
}
function nativeEventMetadata(input, event, runtime) {
    return {
        native_event_contract_version: NATIVE_EVENT_CONTRACT_VERSION,
        native_correlation_source: runtime,
        runtime,
        framework: runtime,
        surface: runtime,
        coverage_level: "detailed",
        source: `te_guard_${runtime}`,
        session_id: safeSessionId(input),
        native_session_id_hash: safeSessionId(input),
        conversation_id: safeThreadId(input),
        thread_id: safeThreadId(input),
        task_id: nativeTaskId(input, event, runtime),
        parent_task_id: nativeParentTaskId(input, event, runtime),
        native_lifecycle_event: event,
        native_event_type: eventType(event),
        summary_source: promptSummary(input) ? "native_hook_redacted" : undefined,
        te_tool_capture_version: toolExecutionPhase(event) ? "v1" : undefined,
        te_tool_activity_source: toolExecutionPhase(event) ? "native_hook" : undefined,
        te_tool_execution_phase: toolExecutionPhase(event),
        ...traceparentMetadata(input),
    };
}
function sidecarRunIds(runtime, command) {
    const seed = [runtime, command.join(" "), process.cwd(), Date.now(), process.pid].join(":");
    const suffix = sha(seed).slice(0, 24);
    return {
        requestId: `req_sidecar_${suffix}`,
        runId: `run_sidecar_${suffix}`,
        sessionId: `sidecar_${suffix}`,
    };
}
function upsertHeader(headers, name, value) {
    if (!value)
        return;
    const prefix = `${name.toLowerCase()}:`;
    const index = headers.findIndex((header) => header.toLowerCase().startsWith(prefix));
    const next = `${name}: ${value}`;
    if (index === -1)
        headers.push(next);
    else
        headers[index] = next;
}
function observedCommandEnv(runtime, ids, activeGoal) {
    const env = {
        ...process.env,
        TE_REQUEST_ID: ids.requestId,
        TE_RUN_ID: ids.runId,
        TE_TELEMETRY_SOURCE: "sidecar",
        TE_WORK_ITEM_ID: activeGoal?.work_item_id,
        TE_OUTCOME_CONTEXT_ID: activeGoal?.outcome_context_id,
        TE_OUTCOME_KEY: activeGoal?.outcome_key || activeGoal?.goal_key,
        TE_GOAL_KEY: activeGoal?.outcome_key || activeGoal?.goal_key,
        TE_INITIATIVE_ID: process.env.TE_INITIATIVE_ID,
        TE_NATIVE_SOURCE: runtime,
        TE_NATIVE_SESSION_ID: ids.sessionId,
        TE_NATIVE_THREAD_ID: ids.sessionId,
        TE_NATIVE_TASK_ID: `sidecar:${ids.sessionId}:command`,
    };
    if (runtime === "claude_code" || RICH_WRAPPER_RUNTIMES.has(runtime)) {
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
        upsertHeader(headers, "X-TE-Initiative-ID", env.TE_INITIATIVE_ID);
        upsertHeader(headers, "X-TE-Native-Source", runtime);
        upsertHeader(headers, "X-TE-Native-Session-ID", ids.sessionId);
        upsertHeader(headers, "X-TE-Native-Thread-ID", ids.sessionId);
        upsertHeader(headers, "X-TE-Native-Task-ID", `sidecar:${ids.sessionId}:command`);
        env.ANTHROPIC_CUSTOM_HEADERS = headers.join("\n");
        env.TE_CUSTOM_HEADERS = headers.join("\n");
        env.OPENAI_EXTRA_HEADERS = headers.join("\n");
    }
    return env;
}
function installClaudeGoalCommand(projectDir) {
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
function resolveClaudeProjectDir(project) {
    const resolved = path.resolve(project);
    const warnings = [];
    if (path.basename(resolved).toLowerCase() === ".claude") {
        warnings.push(`--project pointed at a .claude folder; using its parent project directory: ${path.dirname(resolved)}`);
        return { projectDir: path.dirname(resolved), warnings };
    }
    return { projectDir: resolved, warnings };
}
function claudeSettingsPath(projectDir, shared = false) {
    return path.join(projectDir, ".claude", shared ? "settings.json" : "settings.local.json");
}
function claudeSiblingDir(projectDir) {
    return `${projectDir}.claude`;
}
function findClaudeSibling(projectDir) {
    const sibling = claudeSiblingDir(projectDir);
    return fs.existsSync(sibling) && fs.statSync(sibling).isDirectory() ? sibling : undefined;
}
function copyMissingTree(source, destination) {
    const copied = [];
    if (!fs.existsSync(source))
        return copied;
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, entry.name);
        const destinationPath = path.join(destination, entry.name);
        if (fs.existsSync(destinationPath))
            continue;
        if (entry.isDirectory()) {
            fs.cpSync(sourcePath, destinationPath, { recursive: true, errorOnExist: false });
        }
        else if (entry.isFile()) {
            fs.copyFileSync(sourcePath, destinationPath);
        }
        copied.push(destinationPath);
    }
    return copied;
}
function claudeInstallVerificationLines(projectDir, shared = false) {
    const settingsFile = shared ? "settings.json" : "settings.local.json";
    const projectDisplay = path.relative(process.cwd(), projectDir) || ".";
    return [
        "Verify on Windows PowerShell:",
        `  cd ${projectDisplay}`,
        "  dir .\\.claude",
        `  type .\\.claude\\${settingsFile}`,
        "  claude /hooks",
        "Restart Claude Code from this project root and accept the hook trust review if prompted.",
    ];
}
function claudeStatusPath(projectDir) {
    return path.join(projectDir, ".claude", "tuning-engines-hook-status.jsonl");
}
function appendClaudeHookStatus(projectDir, input, event, uploadStatus, error) {
    try {
        const status = {
            timestamp: new Date().toISOString(),
            event,
            cli_version: version_1.CLI_VERSION,
            upload_status: uploadStatus,
            request_id: requestIdFor(input),
            run_id: runIdFor(input),
            error: error ? redactError(error) : undefined,
            probe: Boolean(input.te_probe),
        };
        fs.mkdirSync(path.join(projectDir, ".claude"), { recursive: true });
        fs.appendFileSync(claudeStatusPath(projectDir), `${JSON.stringify(compact(status))}\n`, { mode: 0o600 });
    }
    catch {
        // Diagnostic-only; never break Claude Code because local status logging failed.
    }
}
function appendClaudeHookStatusForInput(input, event, uploadStatus, error) {
    const projectDir = path.resolve(String(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()));
    appendClaudeHookStatus(projectDir, input, event, uploadStatus, error);
}
function recentClaudeHookStatuses(projectDir, limit = 5) {
    try {
        const statusPath = claudeStatusPath(projectDir);
        if (!fs.existsSync(statusPath))
            return [];
        return fs.readFileSync(statusPath, "utf-8")
            .split(/\r?\n/)
            .filter(Boolean)
            .slice(-limit)
            .map((line) => JSON.parse(line));
    }
    catch {
        return [];
    }
}
function installedHookCommands(settings, event) {
    const entries = Array.isArray(settings.hooks?.[event]) ? settings.hooks[event] : [];
    return entries.flatMap((entry) => {
        const hooks = Array.isArray(entry?.hooks) ? entry.hooks : [];
        return hooks
            .map((hook) => String(hook?.command || hook || ""))
            .filter((command) => command.includes("guard claude-code hook"));
    });
}
function hookCommandPresent(settings, event) {
    return installedHookCommands(settings, event).length > 0;
}
function requiredHookStatus(settings) {
    const required = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure", "Stop"];
    return {
        missing: required.filter((event) => !hookCommandPresent(settings, event)),
        present: required.filter((event) => hookCommandPresent(settings, event)),
    };
}
function claudeDoctorRows(projectDir, shared = false) {
    const settingsPath = claudeSettingsPath(projectDir, shared);
    const projectClaudeDir = path.join(projectDir, ".claude");
    const rows = [];
    const sibling = findClaudeSibling(projectDir);
    rows.push({ level: "ok", check: "Project directory", detail: projectDir });
    if (sibling) {
        rows.push({
            level: "warn",
            check: "Wrong sibling folder detected",
            detail: `${sibling} exists. Claude Code expects ${projectClaudeDir}. Re-run install with --migrate-sibling to copy missing files safely.`,
        });
    }
    if (!fs.existsSync(projectClaudeDir)) {
        rows.push({ level: "fail", check: "Project .claude folder", detail: `${projectClaudeDir} does not exist.` });
    }
    else {
        rows.push({ level: "ok", check: "Project .claude folder", detail: projectClaudeDir });
    }
    let settings = {};
    if (!fs.existsSync(settingsPath)) {
        rows.push({ level: "fail", check: "Claude settings", detail: `${settingsPath} does not exist.` });
    }
    else {
        try {
            settings = readJsonFile(settingsPath);
            rows.push({ level: "ok", check: "Claude settings", detail: settingsPath });
        }
        catch (err) {
            rows.push({ level: "fail", check: "Claude settings JSON", detail: err.message });
        }
    }
    if (Object.keys(settings).length > 0) {
        const hookStatus = requiredHookStatus(settings);
        if (hookStatus.missing.length) {
            rows.push({ level: "fail", check: "Required TE hooks", detail: `Missing: ${hookStatus.missing.join(", ")}` });
        }
        else {
            rows.push({ level: "ok", check: "Required TE hooks", detail: `Present: ${hookStatus.present.join(", ")}` });
        }
    }
    const config = (0, config_1.loadConfig)();
    rows.push({
        level: config.api_key ? "ok" : "warn",
        check: "CLI authentication",
        detail: config.api_key ? "TE_API_KEY or saved token is present." : "No token found. Run te auth login or te config set-token before hook telemetry can upload.",
    });
    if (process.env.ANTHROPIC_AUTH_TOKEN && process.env.ANTHROPIC_API_KEY) {
        rows.push({
            level: "warn",
            check: "Claude authentication variables",
            detail: "Both ANTHROPIC_AUTH_TOKEN and ANTHROPIC_API_KEY are set. Claude Code warns this can make auth behave unexpectedly.",
        });
    }
    const recentStatuses = recentClaudeHookStatuses(projectDir);
    const lastStatus = recentStatuses[recentStatuses.length - 1];
    if (!lastStatus) {
        rows.push({
            level: "warn",
            check: "Recent hook delivery",
            detail: `No local hook status has been recorded yet at ${claudeStatusPath(projectDir)}. Run Claude Code after restart, or run doctor --probe.`,
        });
    }
    else {
        rows.push({
            level: lastStatus.upload_status === "uploaded" ? "ok" : "warn",
            check: "Recent hook delivery",
            detail: `${lastStatus.event} ${lastStatus.upload_status} at ${lastStatus.timestamp} (${lastStatus.run_id || "no run id"}).`,
        });
    }
    rows.push({ level: "ok", check: "CLI version", detail: version_1.CLI_VERSION });
    rows.push({
        level: "warn",
        check: "Claude Code restart",
        detail: "After installing hooks, restart Claude Code from this project root and review /hooks trust settings.",
    });
    return rows;
}
function probePayload(projectDir, event, ids) {
    return compact({
        te_probe: true,
        hook_event_name: event,
        event,
        cwd: projectDir,
        session_id: ids.sessionId,
        conversation_id: ids.sessionId,
        thread_id: ids.sessionId,
        run_id: ids.runId,
        request_id: ids.requestId,
        timestamp: new Date().toISOString(),
        prompt: "Tuning Engines Claude Code hook probe",
        tool_name: "TEProbeTool",
        tool_use_id: "tool_use_te_probe",
        tool_input: { probe: true },
        tool_response: event === "PostToolUse" ? { ok: true, probe: true } : undefined,
    });
}
function traceContainsProbeEvents(trace, requiredEvents, runId, requestId) {
    const found = new Set();
    let eventCount = 0;
    const visit = (value) => {
        if (!value || typeof value !== "object")
            return;
        if (Array.isArray(value)) {
            for (const item of value)
                visit(item);
            return;
        }
        const metadata = value.metadata || {};
        const hookEvent = value.hook_event || value.phase || value.event || value.hook_event_name || metadata.hook_event || metadata.phase || metadata.native_lifecycle_event;
        const matchesRun = [value.run_id, metadata.run_id].filter(Boolean).includes(runId);
        const matchesRequest = [value.request_id, metadata.request_id].filter(Boolean).includes(requestId);
        if (hookEvent && requiredEvents.includes(String(hookEvent)) && (matchesRun || matchesRequest || JSON.stringify(value).includes(runId))) {
            found.add(String(hookEvent));
            eventCount += 1;
        }
        for (const child of Object.values(value))
            visit(child);
    };
    visit(trace);
    return { found: Array.from(found), eventCount };
}
async function waitForProbeTrace(client, runId, requestId, requiredEvents) {
    let lastDetail = "";
    for (let attempt = 1; attempt <= 8; attempt += 1) {
        try {
            const trace = await client.getTrace(runId);
            const seen = traceContainsProbeEvents(trace, requiredEvents, runId, requestId);
            if (requiredEvents.every((event) => seen.found.includes(event))) {
                return { ok: true, detail: `Server trace includes ${seen.found.join(", ")}.`, trace };
            }
            lastDetail = `Server trace found ${seen.found.join(", ") || "no probe events"} on attempt ${attempt}.`;
        }
        catch (err) {
            lastDetail = redactError(err);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return { ok: false, detail: lastDetail || "Server trace was not visible after upload." };
}
async function runClaudeDoctorProbe(client, projectDir, shared = false) {
    const settings = readJsonFile(claudeSettingsPath(projectDir, shared));
    const requiredEvents = ["SessionStart", "PreToolUse", "PostToolUse"];
    const suffix = crypto.randomBytes(8).toString("hex");
    const ids = {
        runId: `run_claude_probe_${suffix}`,
        requestId: `req_claude_probe_${suffix}`,
        sessionId: `te_probe_${suffix}`,
    };
    const commands = [];
    for (const event of requiredEvents) {
        const command = installedHookCommands(settings, event)[0];
        if (!command) {
            commands.push({ event, ok: false, detail: "No installed TE hook command found for this event." });
            continue;
        }
        const result = (0, child_process_1.spawnSync)(command, {
            cwd: projectDir,
            input: JSON.stringify(probePayload(projectDir, event, ids)),
            encoding: "utf8",
            shell: true,
            timeout: 30000,
            env: { ...process.env },
        });
        commands.push({
            event,
            ok: result.status === 0,
            command,
            status: result.status,
            signal: result.signal,
            stdout: redact(String(result.stdout || "")).slice(0, 1000),
            stderr: redact(String(result.stderr || "")).slice(0, 1000),
            detail: result.error ? redactError(result.error) : result.status === 0 ? "Installed hook command executed." : `Installed hook command exited ${result.status}.`,
        });
    }
    const commandsOk = commands.every((entry) => entry.ok);
    const server = commandsOk
        ? await waitForProbeTrace(client, ids.runId, ids.requestId, requiredEvents)
        : { ok: false, detail: "Skipped server visibility check because one or more hook commands failed." };
    return {
        ok: commandsOk && Boolean(server.ok),
        run_id: ids.runId,
        request_id: ids.requestId,
        commands,
        server,
    };
}
function installOpenCode(projectDir) {
    const configPath = path.join(projectDir, "opencode.json");
    const config = readJsonFile(configPath);
    config.$schema ||= "https://opencode.ai/config.json";
    config.plugin = Array(config.plugin || []);
    if (!config.plugin.includes("opencode-helicone-session"))
        config.plugin.push("opencode-helicone-session");
    writeJsonFile(configPath, config);
    const commandPath = path.join(projectDir, ".opencode", "commands", "te-goal.md");
    fs.mkdirSync(path.dirname(commandPath), { recursive: true });
    fs.writeFileSync(commandPath, "---\ndescription: Label the desired Tuning Engines outcome\n---\n\nRun `te goal start \"$ARGUMENTS\"` in the project terminal, then continue the work. Record the result with `te goal complete --result succeeded` when finished.\n", { mode: 0o600 });
    return [configPath, commandPath];
}
function installCline(projectDir, commandName = "cline") {
    const hookDir = path.join(projectDir, ".clinerules", "hooks");
    fs.mkdirSync(hookDir, { recursive: true });
    return CLINE_HOOK_EVENTS.map((event) => {
        const hookPath = path.join(hookDir, event);
        fs.writeFileSync(hookPath, `#!/bin/bash\nte guard ${commandName} hook --event ${event}\necho '{"cancel":false}'\n`, { mode: 0o755 });
        fs.chmodSync(hookPath, 0o755);
        return hookPath;
    });
}
function spawnObservedCommand(command, args, env) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(command, args, {
            stdio: "inherit",
            shell: process.platform === "win32",
            env,
        });
        child.on("error", reject);
        child.on("exit", (code, signal) => {
            if (signal) {
                console.error(`Observed command ended with signal ${signal}`);
                resolve(1);
            }
            else {
                resolve(code ?? 0);
            }
        });
    });
}
async function recordSidecarRun(client, runtime, command, ids, status, eventStatusValue, exitCode) {
    const now = new Date().toISOString();
    const goal = (0, goal_context_1.goalMetadata)(undefined, ids.sessionId);
    const workspace = workspaceMetadata({});
    const safeCommand = redact(command.join(" ")).slice(0, 400);
    const input = { session_id: ids.sessionId, command: safeCommand };
    const lifecycleEvent = eventStatusValue === "started" ? "SessionStart" : "SessionEnd";
    const nativeMetadata = nativeEventMetadata(input, lifecycleEvent, runtime);
    const modelMetadata = modelEnvMetadata();
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
            conversation_id: ids.sessionId,
            thread_id: ids.sessionId,
            ...workspace,
            command: safeCommand,
            ...modelMetadata,
            ...nativeMetadata,
            framework: runtime,
            source: "te_guard_run",
            telemetry_source: "sidecar",
            exit_code: exitCode,
            ...goal,
        },
        events: [
            {
                id: nativeEventId(input, lifecycleEvent, runtime),
                parent_id: nativeParentEventId(input, lifecycleEvent, runtime),
                type: eventStatusValue === "started" ? "agent.message" : "action.finalized",
                status: eventStatusValue,
                at: now,
                metadata: compact({
                    request_id: ids.requestId,
                    run_id: ids.runId,
                    session_id: ids.sessionId,
                    conversation_id: ids.sessionId,
                    thread_id: ids.sessionId,
                    runtime,
                    source: "te_guard_run",
                    telemetry_source: "sidecar",
                    command: safeCommand,
                    ...modelMetadata,
                    ...nativeMetadata,
                    ...workspace,
                    exit_code: exitCode,
                    ...goal,
                }),
            },
        ],
    });
}
function traceRuntimeLabel(runtime) {
    if (runtime === "codex")
        return "Codex";
    if (runtime === "claude_code")
        return "Claude Code";
    if (runtime === "opencode")
        return "OpenCode";
    if (runtime === "roo_code")
        return "Roo Code";
    if (runtime === "aider")
        return "Aider";
    if (runtime === "continue")
        return "Continue";
    if (runtime === "zed")
        return "Zed";
    return runtime
        .split(/[_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ") || "Sidecar";
}
async function recordTrace(client, input, event, decision, runtime = "claude_code") {
    const runId = runIdFor(input, runtime);
    const requestId = requestIdFor(input, runtime);
    const tool = toolName(input);
    const now = new Date().toISOString();
    const goal = (0, goal_context_1.goalMetadata)(input.cwd, sessionId(input));
    const nativeGoal = nativeGoalMetadata(input, event, runtime);
    const workspace = workspaceMetadata(input);
    const nativeMetadata = nativeEventMetadata(input, event, runtime);
    const modelMetadata = modelEnvMetadata();
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
            conversation_id: input.conversation_id || input.thread_id || sessionId(input),
            thread_id: threadId(input),
            ...workspace,
            ...modelMetadata,
            turn_id: input.turn_id,
            task_id: input.task_id,
            parent_task_id: input.parent_task_id,
            agent_id: input.agent_id,
            parent_agent_id: input.parent_agent_id,
            ...nativeMetadata,
            ...goal,
            ...nativeGoal,
        },
        events: [
            {
                id: nativeEventId(input, event, runtime),
                parent_id: nativeParentEventId(input, event, runtime),
                type: eventType(event),
                status: eventStatus(event, decision),
                at: now,
                metadata: compact({
                    request_id: requestId,
                    run_id: runId,
                    session_id: safeSessionId(input),
                    conversation_id: input.conversation_id || input.thread_id || sessionId(input),
                    thread_id: threadId(input),
                    hook_event: event,
                    phase: event,
                    name: tool || event,
                    tool_name: tool,
                    tool_input: event === "PostToolUse" ? undefined : toolInput(input),
                    tool_response: event === "PostToolUse" ? toolResponse(input) : undefined,
                    ...workspace,
                    ...modelMetadata,
                    prompt_summary: promptSummary(input),
                    turn_id: input.turn_id,
                    task_id: input.task_id,
                    parent_task_id: input.parent_task_id,
                    agent_id: input.agent_id,
                    parent_agent_id: input.parent_agent_id,
                    ...nativeMetadata,
                    decision,
                    ...goal,
                    ...nativeGoal,
                }),
            },
        ],
    });
}
async function evaluatePreToolUse(client, input, event, mode) {
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
function registerGuardCommands(program, getClient) {
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
    const roo = guard.command("roo").description("Install Roo Code lifecycle hooks");
    guard
        .command("run")
        .description("Run a local agent command with sidecar lifecycle tracing")
        .option("--runtime <runtime>", "Runtime label, e.g. codex, anthropic_sdk, custom", "custom")
        .allowUnknownOption(true)
        .argument("[command...]", "Command to run after --")
        .action(async (commandParts, opts) => {
        if (!commandParts.length) {
            console.error("Usage: te guard run --runtime codex -- codex");
            process.exit(1);
        }
        const runtime = String(opts.runtime || "custom");
        const [command, ...args] = commandParts;
        const ids = sidecarRunIds(runtime, commandParts);
        const client = getClient();
        const activeGoal = (0, goal_context_1.loadGoalContext)();
        try {
            await recordSidecarRun(client, runtime, commandParts, ids, "running", "started");
        }
        catch (err) {
            console.error(`Tuning Engines guard warning: ${err.message}`);
        }
        let exitCode = 0;
        try {
            exitCode = await spawnObservedCommand(command, args, observedCommandEnv(runtime, ids, activeGoal));
        }
        catch (err) {
            console.error(`Observed command failed to start: ${err.message}`);
            exitCode = 127;
        }
        try {
            await recordSidecarRun(client, runtime, commandParts, ids, exitCode === 0 ? "succeeded" : "failed", exitCode === 0 ? "succeeded" : "failed", exitCode);
        }
        catch (err) {
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
        .option("--migrate-sibling", "Copy missing files from an accidental sibling <project>.claude folder")
        .option("--dry-run", "Print the resulting settings without writing")
        .option("--json", "Output as JSON")
        .action((opts) => {
        try {
            const mode = opts.mode === "observe" ? "observe" : "enforce";
            const { projectDir, warnings } = resolveClaudeProjectDir(opts.project);
            const settingsPath = claudeSettingsPath(projectDir, Boolean(opts.shared));
            const sibling = findClaudeSibling(projectDir);
            const copied = opts.migrateSibling && sibling
                ? copyMissingTree(sibling, path.join(projectDir, ".claude"))
                : [];
            const settings = readJsonFile(settingsPath);
            settings.hooks ||= {};
            removeExistingGuardHooks(settings.hooks);
            for (const event of HOOK_EVENTS)
                installHook(settings, event, mode, Boolean(opts.failOpen));
            if (opts.dryRun || opts.json) {
                output.json({
                    path: settingsPath,
                    project_dir: projectDir,
                    sibling_claude_dir: sibling,
                    migrated_paths: copied,
                    warnings,
                    settings: redactForOutput(settings),
                });
                return;
            }
            writeJsonFile(settingsPath, settings);
            const commandPath = installClaudeGoalCommand(projectDir);
            for (const warning of warnings)
                console.warn(`Warning: ${warning}`);
            if (sibling) {
                console.warn(`Warning: found ${sibling}, but Claude Code expects ${path.join(projectDir, ".claude")}.`);
            }
            if (sibling && !opts.migrateSibling) {
                console.warn("Re-run with --migrate-sibling to copy missing commands/settings safely.");
            }
            if (copied.length) {
                console.log(`Copied ${copied.length} missing item(s) from ${sibling} into ${path.join(projectDir, ".claude")}.`);
            }
            console.log(`Installed Claude Code guard hooks in ${settingsPath}`);
            console.log(`Installed /te-goal helper in ${commandPath}`);
            console.log(`Mode: ${claudeInstallModeSummary(mode, Boolean(opts.failOpen))}`);
            console.log("Run Claude Code from this project; actions will appear in Inference > Work Sessions.");
            for (const line of claudeInstallVerificationLines(projectDir, Boolean(opts.shared)))
                console.log(line);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    claude
        .command("doctor")
        .description("Check Claude Code hook installation and common capture problems")
        .option("--project <dir>", "Project directory", process.cwd())
        .option("--shared", "Check .claude/settings.json instead of .claude/settings.local.json")
        .option("--probe", "Execute installed hooks with synthetic events and verify server visibility")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const { projectDir, warnings } = resolveClaudeProjectDir(opts.project);
            const rows = claudeDoctorRows(projectDir, Boolean(opts.shared));
            const ok = rows.every((row) => row.level !== "fail");
            const probe = opts.probe && ok
                ? await runClaudeDoctorProbe(getClient(), projectDir, Boolean(opts.shared))
                : undefined;
            const finalOk = ok && (!opts.probe || Boolean(probe?.ok));
            if (opts.json) {
                output.json({
                    ok: finalOk,
                    project_dir: projectDir,
                    settings_path: claudeSettingsPath(projectDir, Boolean(opts.shared)),
                    warnings,
                    checks: rows,
                    probe,
                    next_steps: claudeInstallVerificationLines(projectDir, Boolean(opts.shared)),
                });
                if (!finalOk)
                    process.exit(1);
                return;
            }
            console.log("Claude Code hook doctor");
            console.log(`Project: ${projectDir}`);
            console.log(`Settings: ${claudeSettingsPath(projectDir, Boolean(opts.shared))}`);
            for (const warning of warnings)
                console.warn(`Warning: ${warning}`);
            for (const row of rows) {
                const marker = row.level === "ok" ? "OK" : row.level === "warn" ? "WARN" : "FAIL";
                console.log(`[${marker}] ${row.check}: ${row.detail}`);
            }
            console.log("");
            for (const line of claudeInstallVerificationLines(projectDir, Boolean(opts.shared)))
                console.log(line);
            if (opts.probe) {
                console.log("");
                if (!ok) {
                    console.log("Probe skipped because static doctor checks failed.");
                }
                else if (probe) {
                    console.log("Claude Code hook probe");
                    console.log(`Run: ${probe.run_id}`);
                    console.log(`Request: ${probe.request_id}`);
                    for (const command of probe.commands) {
                        const marker = command.ok ? "OK" : "FAIL";
                        console.log(`[${marker}] ${command.event}: ${command.detail}`);
                        if (!command.ok && command.stderr)
                            console.log(`  ${command.stderr}`);
                    }
                    console.log(`[${probe.server.ok ? "OK" : "FAIL"}] Server visibility: ${probe.server.detail}`);
                }
            }
            if (!finalOk)
                process.exit(1);
        }
        catch (err) {
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
        const mode = opts.mode === "observe" ? "observe" : "enforce";
        const failOpen = Boolean(opts.failOpen);
        let input = {};
        let currentEvent = opts.event;
        try {
            input = safeJsonParse(await readStdin());
            const event = hookEvent(input, opts.event);
            currentEvent = event;
            const client = getClient();
            let decision;
            if (event === "PreToolUse") {
                decision = await evaluatePreToolUse(client, input, event, mode);
            }
            await recordTrace(client, input, event, decision);
            appendClaudeHookStatusForInput(input, event, "uploaded");
            if (event === "PreToolUse" && decision?.allowed === false && mode === "enforce") {
                appendClaudeHookStatusForInput(input, event, "blocked", decision.message || decision.reason || "Blocked by Tuning Engines policy");
                console.error(decision.message || decision.reason || "Blocked by Tuning Engines policy");
                process.exit(2);
            }
        }
        catch (err) {
            appendClaudeHookStatusForInput(input, currentEvent || "unknown", "failed", err);
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
            for (const event of CODEX_HOOK_EVENTS)
                installCodexHook(settings, event);
            if (opts.dryRun || opts.json) {
                output.json({ path: settingsPath, settings: redactForOutput(settings) });
                return;
            }
            writeJsonFile(settingsPath, settings);
            console.log(`Installed Codex hooks in ${settingsPath}`);
            console.log("Review and trust the project hooks from Codex /hooks before relying on native goal telemetry.");
            console.log("Native /goal declarations will appear in Inference > Work Sessions.");
        }
        catch (err) {
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
        }
        catch (err) {
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
        }
        catch (err) {
            console.error(`Tuning Engines Codex telemetry warning: ${err.message}`);
        }
    });
    opencode.command("install").description("Install OpenCode session tracking and /te-goal helper")
        .option("--project <dir>", "Project directory", process.cwd()).action((opts) => {
        try {
            const paths = installOpenCode(path.resolve(opts.project));
            console.log(`Installed OpenCode session tracking in ${paths.join(" and ")}`);
            console.log("OpenCode will load opencode-helicone-session on startup; Tuning Engines recognizes its pseudonymous session header.");
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    cline.command("install").description("Install Cline project hooks")
        .option("--project <dir>", "Project directory", process.cwd()).action((opts) => {
        try {
            const paths = installCline(path.resolve(opts.project), "cline");
            console.log(`Installed ${paths.length} Cline hooks in ${path.dirname(paths[0])}`);
            console.log("Enable project hooks in Cline; each task will appear as one Work Session.");
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    cline.command("hook").description("Cline hook entrypoint. Reads hook JSON from stdin.")
        .option("--event <event>", "Cline hook event name").action(async (opts) => {
        try {
            const input = safeJsonParse(await readStdin());
            await recordTrace(getClient(), input, hookEvent(input, opts.event), undefined, "cline");
        }
        catch (err) {
            console.error(`Tuning Engines Cline telemetry warning: ${err.message}`);
        }
    });
    roo.command("install").description("Install Roo Code project hooks")
        .option("--project <dir>", "Project directory", process.cwd()).action((opts) => {
        try {
            const paths = installCline(path.resolve(opts.project), "roo");
            console.log(`Installed ${paths.length} Roo Code-compatible hooks in ${path.dirname(paths[0])}`);
            console.log("Enable project hooks in Roo Code; each task will appear as one Work Session.");
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    roo.command("hook").description("Roo Code hook entrypoint. Reads hook JSON from stdin.")
        .option("--event <event>", "Roo Code hook event name").action(async (opts) => {
        try {
            const input = safeJsonParse(await readStdin());
            await recordTrace(getClient(), input, hookEvent(input, opts.event), undefined, "roo_code");
        }
        catch (err) {
            console.error(`Tuning Engines Roo Code telemetry warning: ${err.message}`);
        }
    });
}
//# sourceMappingURL=guard.js.map