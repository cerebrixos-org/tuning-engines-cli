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
const NATIVE_EVENT_CONTRACT_VERSION = "te-native-event-v2";
const HOOK_EVENTS = [
    "SessionStart",
    "SessionEnd",
    "UserPromptSubmit",
    "UserPromptExpansion",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "PostToolBatch",
    "PermissionRequest",
    "PermissionDenied",
    "SubagentStart",
    "Stop",
    "StopFailure",
    "SubagentStop",
    "TaskCreated",
    "TaskCompleted",
];
const CLINE_HOOK_EVENTS = ["TaskStart", "TaskResume", "TaskCancel", "TaskComplete", "PreToolUse", "PostToolUse", "UserPromptSubmit", "PreCompact"];
const CODEX_HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PermissionRequest", "SessionEnd", "PreCompact", "PostCompact", "Stop", "SubagentStart", "SubagentStop"];
const RICH_WRAPPER_RUNTIMES = new Set(["codex", "opencode", "aider", "continue", "zed", "custom"]);
const TURN_SCOPED_RUNTIMES = new Set(["codex", "claude_code"]);
const TOOL_LIFECYCLE_EVENTS = new Set(["PreToolUse", "PostToolUse", "PostToolUseFailure", "tool.execute.before", "tool.execute.after"]);
const SECRET_PATTERNS = [
    /\bsk-te-[A-Za-z0-9_\-]{16,}\b/g,
    /\bsk-[A-Za-z0-9_\-]{8,}\b/g,
    /\bte_[A-Za-z0-9_\-]{16,}\b/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"'\s,}]+/gi,
    /\bgAAAA[A-Za-z0-9_-]{16,}\b/g,
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
function resolvedCliEntrypoint() {
    return path.resolve(process.argv[1] || __filename);
}
function shellQuote(value) {
    if (process.platform === "win32")
        return `"${value.replace(/"/g, '\\"')}"`;
    return `'${value.replace(/'/g, "'\\''")}'`;
}
function installedCliCommand(args) {
    return [process.execPath, resolvedCliEntrypoint(), ...args].map(shellQuote).join(" ");
}
function hookCommand(event, mode, failOpen) {
    const pieces = ["guard", "claude-code", "hook", "--event", event, "--mode", mode];
    if (failOpen)
        pieces.push("--fail-open");
    return installedCliCommand(pieces);
}
function claudeInstallModeSummary(mode, failOpen) {
    if (mode === "observe")
        return "observe (records activity only; tools will not be blocked)";
    return failOpen ? "enforce (fail-open)" : "enforce (fail-closed for PreToolUse)";
}
function codexHookCommand(event) {
    return installedCliCommand(["guard", "codex", "hook", "--event", event]);
}
function isGuardHookCommand(command, runtime) {
    const normalized = String(command || "").replace(/["']/g, "").replace(/\s+/g, " ");
    return normalized.includes(`guard ${runtime} hook`);
}
function removeExistingGuardHooks(hooks) {
    for (const event of Object.keys(hooks || {})) {
        hooks[event] = Array.isArray(hooks[event])
            ? hooks[event]
                .map((entry) => ({
                ...entry,
                hooks: Array.isArray(entry.hooks)
                    ? entry.hooks.filter((hook) => !isGuardHookCommand(hook.command, "claude-code"))
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
    if (event === "PreToolUse" || event === "PostToolUse" || event === "PostToolUseFailure" || event === "PermissionRequest" || event === "PermissionDenied")
        entry.matcher = "*";
    settings.hooks[event].push(entry);
}
function existingClaudeHookMode(settings) {
    for (const entries of Object.values(settings.hooks || {})) {
        for (const entry of Array.isArray(entries) ? entries : []) {
            for (const hook of Array.isArray(entry?.hooks) ? entry.hooks : []) {
                const command = String(hook?.command || "");
                if (!isGuardHookCommand(command, "claude-code"))
                    continue;
                return {
                    mode: command.includes("--mode observe") ? "observe" : "enforce",
                    failOpen: command.includes("--fail-open"),
                };
            }
        }
    }
    return undefined;
}
function writeClaudeHooks(project, options = {}) {
    const { projectDir, warnings } = resolveClaudeProjectDir(project);
    const settingsPath = claudeSettingsPath(projectDir, Boolean(options.shared));
    const settings = readJsonFile(settingsPath);
    const existing = existingClaudeHookMode(settings);
    const mode = options.mode || existing?.mode || "observe";
    const failOpen = options.failOpen ?? existing?.failOpen ?? false;
    const before = JSON.stringify(settings);
    settings.hooks ||= {};
    removeExistingGuardHooks(settings.hooks);
    for (const event of HOOK_EVENTS)
        installHook(settings, event, mode, failOpen);
    const changed = before !== JSON.stringify(settings);
    if (options.write !== false && changed)
        writeJsonFile(settingsPath, settings);
    if (options.write !== false)
        installClaudeGoalCommand(projectDir);
    return { settingsPath, projectDir, mode, failOpen, changed, warnings };
}
function removeExistingCodexHooks(hooks) {
    for (const event of Object.keys(hooks || {})) {
        hooks[event] = Array.isArray(hooks[event])
            ? hooks[event]
                .map((entry) => ({
                ...entry,
                hooks: Array.isArray(entry.hooks)
                    ? entry.hooks.filter((hook) => !isGuardHookCommand(hook.command, "codex"))
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
    if (event === "PreToolUse" || event === "PostToolUse" || event === "PostToolUseFailure" || event === "PermissionRequest")
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
function compactString(value, limit = 240) {
    if (value === undefined || value === null)
        return undefined;
    if (typeof value === "object" && Object.keys(value).length === 0)
        return undefined;
    const text = typeof value === "string" ? value : JSON.stringify(compact(value));
    const normalized = redact(text).replace(/\s+/g, " ").trim();
    return normalized && normalized !== "{}" && normalized !== "[]" ? normalized.slice(0, limit) : undefined;
}
function safeDescriptiveText(value, limit = 240) {
    if (typeof value !== "string")
        return undefined;
    const raw = value.trim();
    if (!raw ||
        raw.includes("\n") ||
        /(?:^|:\s*)[\{\[]/.test(raw) ||
        /\bgAAAA[A-Za-z0-9_-]{16,}\b/.test(raw) ||
        /^(?:Codex proposed|Bash completed|Shell command completed):/i.test(raw) ||
        /(?:&&|\|\||[|;`]|\$\()/.test(raw))
        return undefined;
    return compactString(raw, limit);
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
    const explicit = boundedId(firstPresent(input.run_id, input.te_run_id));
    if (explicit)
        return explicit;
    const turn = firstPresent(input.turn_id, input.turnId);
    if (TURN_SCOPED_RUNTIMES.has(runtime) && turn)
        return `run_${runtimeSlug(runtime)}_${sha(turn).slice(0, 24)}`;
    const environmentId = boundedId(process.env.TE_RUN_ID);
    if (environmentId)
        return environmentId;
    return `run_${runtimeSlug(runtime)}_${sha(sessionId(input)).slice(0, 24)}`;
}
function requestIdFor(input, runtime = "claude_code") {
    const explicit = boundedId(firstPresent(input.request_id, input.te_request_id));
    if (explicit)
        return explicit;
    const turn = firstPresent(input.turn_id, input.turnId);
    if (TURN_SCOPED_RUNTIMES.has(runtime) && turn)
        return `req_${runtimeSlug(runtime)}_${sha(turn).slice(0, 24)}`;
    const environmentId = boundedId(process.env.TE_REQUEST_ID);
    if (environmentId)
        return environmentId;
    return `req_${runtimeSlug(runtime)}_${sha(sessionId(input)).slice(0, 24)}`;
}
function toolName(input) {
    return input.tool_name || input.name || input.tool?.name || input.preToolUse?.toolName || input.postToolUse?.toolName;
}
function toolInput(input) {
    return input.tool_input || input.toolInput || input.input || input.arguments || input.args || input.tool?.input || input.tool?.arguments || {};
}
function toolResponse(input) {
    return input.tool_response || input.toolResponse || input.output || input.response || input.result || {};
}
function eventType(event) {
    if (event === "UserPromptSubmit")
        return "agent.turn";
    if (event === "PermissionRequest" || event === "permission.asked")
        return "approval.requested";
    if (event === "PermissionDenied" || event === "approval.denied")
        return "approval.denied";
    if (event === "approval.approved")
        return "approval.approved";
    if (event === "permission.replied")
        return "approval.requested";
    if (event === "SessionEnd" || event === "Stop" || event === "StopFailure" || event === "SubagentStop" || event === "AfterTask" || event === "TaskComplete" || event === "TaskCompleted" || event === "TaskCancel")
        return "action.finalized";
    if (event === "PreToolUse" || event === "PostToolUse" || event === "PostToolUseFailure" || event === "tool.execute.before" || event === "tool.execute.after")
        return "agent.tool_call";
    if (event === "SessionStart" || event === "TaskStart" || event === "TaskCreated" || event === "TaskResume" || event === "PostToolBatch" || event === "PreCompact" || event === "PostCompact" || event === "UserPromptExpansion" || event === "AfterAgent" || event === "session.created" || event === "session.idle" || event === "session.error")
        return "workflow.step";
    if (event === "SubagentStart")
        return "agent.message";
    return "custom.claude_code";
}
function eventStatus(event, decision) {
    if (decision && decision.allowed === false)
        return "blocked";
    if (event === "PreToolUse" || event === "PermissionRequest" || event === "permission.asked" || event === "tool.execute.before")
        return "proposed";
    if (event === "PermissionDenied" || event === "approval.denied")
        return "blocked";
    if (event === "approval.approved")
        return "succeeded";
    if (event === "PostToolUseFailure" || event === "StopFailure" || event === "TaskCancel" || event === "session.error")
        return "failed";
    if (event === "PostToolUse")
        return "succeeded";
    if (event === "tool.execute.after")
        return "succeeded";
    if (event === "SessionEnd" || event === "Stop" || event === "SubagentStop" || event === "AfterTask" || event === "TaskComplete" || event === "TaskCompleted" || event === "PostToolBatch")
        return "succeeded";
    return "started";
}
function statusForEvent(input, event, decision) {
    if (decision && decision.allowed === false)
        return "blocked";
    if (event === "PostToolUse" || event === "tool.execute.after")
        return hookFailureData(input).failed ? "failed" : "succeeded";
    if (event === "permission.replied")
        return permissionGranted(input) ? "succeeded" : "blocked";
    return eventStatus(event, decision);
}
function toolExecutionPhase(event, input = {}) {
    if (event === "PreToolUse" || event === "tool.execute.before")
        return "proposed";
    if (event === "PostToolUse" || event === "tool.execute.after")
        return hookFailureData(input).failed ? "failed" : "executed";
    if (event === "PostToolUseFailure")
        return "failed";
    if (event === "PermissionRequest" || event === "permission.asked")
        return "proposed";
    if (event === "PermissionDenied" || event === "approval.denied")
        return "blocked";
    if (event === "approval.approved")
        return "approved";
    return undefined;
}
function permissionGranted(input) {
    const value = firstPresent(input.granted, input.approved, input.allowed, input.response?.granted, input.response?.approved, input.response?.allowed);
    const normalized = String(value).toLowerCase();
    return normalized === "true" || normalized === "approved" || normalized === "allow";
}
function stableTurnId(input, runtime) {
    const explicit = firstPresent(input.turn_id, input.turnId, input.message_id, input.messageId, input.prompt_id, input.promptId);
    if (explicit)
        return boundedId(explicit);
    return `turn_${sha([runtime, sessionId(input), promptSummary(input) || input.timestamp || ""].join(":")).slice(0, 24)}`;
}
function toolCallId(input, runtime) {
    const explicit = firstPresent(input.tool_call_id, input.tool_use_id, input.toolUseId, input.call_id, input.callId, input.id, input.tool?.call_id, input.tool?.id, input.tool_call?.id);
    if (explicit)
        return boundedId(explicit);
    const tool = toolName(input);
    if (!tool)
        return undefined;
    return `tool_${sha([runtime, sessionId(input), stableTurnId(input, runtime), tool, compactString(toolInput(input), 800) || ""].join(":")).slice(0, 24)}`;
}
function exitCode(input) {
    const value = firstPresent(input.exit_code, input.exitCode, input.code, input.result?.exit_code, input.result?.exitCode, input.tool_response?.exit_code, input.toolResponse?.exitCode, input.output?.exit_code);
    if (value === undefined)
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function hookFailureData(input) {
    const response = toolResponse(input);
    const code = exitCode(input);
    const rawError = firstPresent(input.error, input.failure, input.exception, input.error_message, input.errorMessage, input.result?.error, input.result?.failure, input.output?.error, input.response?.error, input.tool_response?.error, input.toolResponse?.error);
    const failed = input.success === false ||
        input.ok === false ||
        input.result?.success === false ||
        input.result?.ok === false ||
        response?.success === false ||
        response?.ok === false ||
        Boolean(rawError) ||
        (code !== undefined && code !== 0);
    return {
        failed,
        error: rawError ? redactError(rawError) : undefined,
        exit_code: code,
    };
}
function previewForInput(input) {
    return compactString(firstPresent(input.input_preview, input.inputPreview, input.arguments_preview, input.args_preview, safeToolInputPreview(input)));
}
function previewForResponse(input) {
    if (toolName(input)) {
        return safeDescriptiveText(firstPresent(input.result_summary, toolResponse(input)?.summary), 240);
    }
    return compactString(firstPresent(input.response_preview, input.responsePreview, input.output_preview, input.outputPreview, input.last_assistant_message, input.result_summary), 1200);
}
function humanSummary(input, event, runtime) {
    const tool = toolName(input);
    const failure = hookFailureData(input);
    if (event === "UserPromptSubmit")
        return "User submitted a prompt.";
    if (event === "PermissionRequest" || event === "permission.asked")
        return "Approval requested.";
    if (event === "PermissionDenied")
        return "Approval denied.";
    if (event === "permission.replied")
        return permissionGranted(input) ? "OpenCode permission approved." : "OpenCode permission denied.";
    if (event === "SubagentStart")
        return "Started a delegated task.";
    if (event === "SubagentStop")
        return failure.failed ? "Delegated task failed." : "Delegated task completed.";
    if (event === "Stop")
        return failure.failed ? "Agent response failed." : "Agent response completed.";
    if (event === "SessionEnd")
        return failure.failed ? `${traceRuntimeLabel(runtime)} session failed.` : `${traceRuntimeLabel(runtime)} session completed.`;
    if (event === "PreToolUse" || event === "tool.execute.before")
        return operationSummary(operationClass(input), "proposed");
    if (event === "PostToolUse" || event === "PostToolUseFailure" || event === "tool.execute.after") {
        return operationSummary(operationClass(input), failure.failed ? "failed" : "succeeded");
    }
    return event === "SessionStart" ? "Session started." : "Agent lifecycle event recorded.";
}
function operationClass(input) {
    const name = String(toolName(input) || "").toLowerCase();
    const command = String(firstPresent(toolInput(input)?.command, toolInput(input)?.cmd, toolInput(input)?.script) || "").toLowerCase();
    if (/read|view|cat/.test(name))
        return "file_read";
    if (/write|edit|patch|notebook/.test(name))
        return "file_change";
    if (/grep|glob|search|find/.test(name) || /(^|\s)(rg|grep|find)(\s|$)/.test(command))
        return "repository_search";
    if (/^git\b/.test(command))
        return "git_inspection";
    if (/(^|\s)(pytest|rspec|rails test|npm test|npm run test|yarn test|pnpm test|go test|cargo test)(\s|$)/.test(command))
        return "test_runner";
    if (/(^|\s)(curl|wget|httpie)(\s|$)/.test(command) || /http|fetch|request/.test(name))
        return "http_client";
    if (/bash|shell|terminal|command|exec/.test(name))
        return "shell_command";
    return "tool_operation";
}
function operationSummary(operation, status) {
    const base = {
        repository_search: "Searched the repository",
        file_read: "Read a source file",
        file_change: "Modified a source file",
        git_inspection: "Inspected Git changes",
        test_runner: "Ran the test suite",
        http_client: "Called an external service",
        shell_command: "Ran a shell command",
        tool_operation: "Ran a tool",
    };
    const phrase = base[operation] || base.tool_operation;
    if (status === "proposed")
        return `${phrase}.`;
    return `${phrase} ${status === "failed" ? "unsuccessfully" : "successfully"}.`;
}
function safeRelativePath(value, cwd) {
    const raw = String(value || "").trim();
    if (!raw || raw.includes("\0") || raw.includes("\n") || raw.startsWith("gAAAA"))
        return undefined;
    const redacted = redact(raw);
    if (redacted.includes("[FILTERED]"))
        return undefined;
    const normalized = redacted.replace(/\\/g, "/");
    if (!path.isAbsolute(raw))
        return normalized.replace(/^\.\//, "").slice(0, 180);
    const base = cwd ? path.resolve(String(cwd)) : undefined;
    const relative = base ? path.relative(base, raw).replace(/\\/g, "/") : "";
    if (relative && !relative.startsWith("../") && relative !== "..")
        return relative.slice(0, 180);
    return path.basename(raw).slice(0, 180);
}
function toolPath(input) {
    const values = toolInput(input) || {};
    return safeRelativePath(firstPresent(values.file_path, values.filePath, values.path, values.filename, values.target_file, values.targetFile), input.cwd);
}
function friendlyToolLabel(value) {
    if (/^(bash|shell|exec_command|write_stdin)$/i.test(value))
        return "Shell command";
    if (/^(apply_patch|edit|write)$/i.test(value))
        return "File update";
    if (/^(read|read_file|view)$/i.test(value))
        return "File read";
    return value.replace(/^mcp__/, "").replace(/__/g, " · ").replace(/_/g, " ");
}
function safeToolInputPreview(input) {
    const values = toolInput(input) || {};
    return safeDescriptiveText(firstPresent(values.summary, values.description, values.task_name, values.taskName, values.name, toolPath(input)));
}
function shellCommandSummary(input) {
    const values = toolInput(input) || {};
    const command = String(firstPresent(values.command, values.cmd, values.script) || "");
    if (!command)
        return undefined;
    const lower = command.toLowerCase();
    if (/(?:redis|cache|solid_cache|memcached)/.test(lower))
        return "Checked cache configuration";
    if (/(?:database|database\.yml|postgres|mysql|sqlite|db:)/.test(lower)) {
        return /(?:\brg\b|\bgrep\b|\bfind\b)/.test(lower)
            ? "Searched project configuration for database settings"
            : "Checked database configuration";
    }
    if (/\bgit\s+status\b/.test(lower))
        return "Checked repository status";
    if (/(?:\brg\b|\bgrep\b)/.test(lower))
        return "Searched project files";
    if (/(?:^|\s)(?:ls|find)(?:\s|$)/.test(lower))
        return "Listed project files";
    return undefined;
}
function safeToolSummary(input, completed) {
    const name = String(toolName(input) || "Tool");
    const file = toolPath(input);
    if (/^(read|read_file|view)$/i.test(name) && file)
        return `Read ${file}`;
    if (/^(write|create|write_file)$/i.test(name) && file)
        return `${completed ? "Created" : "Create"} ${file}`;
    if (/^(edit|apply_patch|update_file)$/i.test(name) && file)
        return `${completed ? "Updated" : "Update"} ${file}`;
    if (/^(spawn_agent|agent|task)$/i.test(name)) {
        return completed
            ? `Subagent finished: ${subagentResultSummary(input) || subagentTaskName(input) || "task completed"}`
            : `Started subagent: ${subagentTaskName(input) || "delegated task"}`;
    }
    if (/^(bash|shell|exec_command|write_stdin)$/i.test(name)) {
        return shellCommandSummary(input) || (completed ? "Shell command completed." : "Run shell command.");
    }
    const safeInput = safeToolInputPreview(input);
    const safeResponse = previewForResponse(input);
    if (completed && safeResponse)
        return `${friendlyToolLabel(name)} completed: ${safeResponse}`;
    if (safeInput)
        return `${completed ? friendlyToolLabel(name) : `Run ${friendlyToolLabel(name)}`}: ${safeInput}`;
    return completed ? `${friendlyToolLabel(name)} completed.` : `Run ${friendlyToolLabel(name)}.`;
}
function subagentTaskName(input) {
    const values = toolInput(input) || {};
    return compactString(firstPresent(input.task_name, input.taskName, input.agent_name, input.agent_type, values.task_name, values.taskName, values.name, values.description), 120);
}
function subagentResultSummary(input) {
    return compactString(firstPresent(input.result_summary, input.last_assistant_message, input.response_preview, toolResponse(input)?.summary), 180);
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
    const callId = toolCallId(input, runtime);
    if (TOOL_LIFECYCLE_EVENTS.has(event) && callId)
        return `${runtime}:tool:${callId}`;
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
    if (event === "SessionStart" || event === "UserPromptSubmit")
        return undefined;
    if (event === "PostToolUse" || event === "PostToolUseFailure" || event === "tool.execute.after")
        return nativeTaskSeed(input, "PreToolUse", runtime);
    if (event === "SubagentStop")
        return nativeTaskSeed(input, "SubagentStart", runtime);
    if (event === "TaskComplete" || event === "TaskCompleted" || event === "TaskCancel")
        return nativeTaskSeed(input, "TaskStart", runtime);
    return nativeTaskSeed(input, "UserPromptSubmit", runtime);
}
function nativeEventId(input, event, runtime) {
    const callId = toolCallId(input, runtime);
    if (TOOL_LIFECYCLE_EVENTS.has(event) && callId)
        return `evt_${sha([runtime, "tool", callId].join(":")).slice(0, 24)}`;
    return `evt_${sha([runtime, nativeTaskSeed(input, event, runtime), event].join(":")).slice(0, 24)}`;
}
function nativeParentEventId(input, event, runtime) {
    if (input.parent_event_id || input.parent_id || input.parent_client_event_id) {
        return String(input.parent_event_id || input.parent_id || input.parent_client_event_id);
    }
    if (event === "SessionStart" || event === "UserPromptSubmit")
        return undefined;
    if (event === "SubagentStop")
        return nativeEventId(input, "SubagentStart", runtime);
    if (event === "TaskComplete" || event === "TaskCompleted" || event === "TaskCancel")
        return nativeEventId(input, "TaskStart", runtime);
    if (input.root_event_id)
        return String(input.root_event_id);
    return nativeEventId(input, "UserPromptSubmit", runtime);
}
function nativeTaskId(input, event, runtime) {
    return `task_${sha(nativeTaskSeed(input, event, runtime)).slice(0, 24)}`;
}
function nativeParentTaskId(input, event, runtime) {
    const seed = nativeParentTaskSeed(input, event, runtime);
    return seed ? `task_${sha(seed).slice(0, 24)}` : undefined;
}
function nativeEventMetadata(input, event, runtime) {
    const callId = toolCallId(input, runtime);
    const turnId = stableTurnId(input, runtime);
    const failure = hookFailureData(input);
    const summary = humanSummary(input, event, runtime);
    const cliEntrypoint = resolvedCliEntrypoint();
    const operation = operationClass(input);
    const command = firstPresent(toolInput(input)?.command, toolInput(input)?.cmd, toolInput(input)?.script);
    const response = toolResponse(input);
    const durationMs = Number(firstPresent(input.duration_ms, input.durationMs, response?.duration_ms, response?.durationMs));
    const resultCount = Number(firstPresent(input.result_count, input.resultCount, response?.result_count, response?.resultCount));
    return {
        native_event_contract_version: NATIVE_EVENT_CONTRACT_VERSION,
        cli_version: version_1.CLI_VERSION,
        resolved_hook_command_path_hash: sha(cliEntrypoint),
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
        turn_id: turnId,
        tool_call_id: callId,
        native_lifecycle_event: event,
        native_event_type: eventType(event),
        trace_id: input.trace_id,
        span_id: input.span_id,
        parent_span_id: input.parent_span_id,
        operation_class: operation,
        command_hash: command ? `sha256:${sha(command)}` : undefined,
        output_hash: Object.keys(response || {}).length ? `sha256:${sha(JSON.stringify(compact(response)))}` : undefined,
        duration_ms: Number.isFinite(durationMs) ? durationMs : undefined,
        result_count: Number.isFinite(resultCount) ? resultCount : undefined,
        human_summary: summary,
        te_display_summary: summary,
        summary_source: summary ? "native_hook_redacted" : undefined,
        error: failure.error,
        exit_code: failure.exit_code,
        success: failure.failed ? false : undefined,
        ok: failure.failed ? false : undefined,
        te_tool_capture_version: toolExecutionPhase(event, input) ? "v1" : undefined,
        te_tool_activity_source: toolExecutionPhase(event, input) ? "native_hook" : undefined,
        te_tool_execution_phase: toolExecutionPhase(event, input),
        workflow_status: event === "SessionEnd" ? (failure.failed ? "failed" : "completed") : undefined,
        outcome_result_status: event === "SessionEnd" ? (failure.failed ? "failed" : "succeeded") : undefined,
        completed_at: event === "SessionEnd" ? new Date().toISOString() : undefined,
        ...traceparentMetadata(input),
    };
}
function nativeTurnStatePath(input, runtime) {
    const nativeSession = firstPresent(input.session_id, input.conversation_id, input.transcript_path, sessionId(input));
    return path.join(process.env.HOME || process.cwd(), ".tuningengines", "sessions", `${runtimeSlug(runtime)}-turns`, `${sha(nativeSession)}.json`);
}
function readNativeTurnState(input, runtime) {
    try {
        const state = readJsonFile(nativeTurnStatePath(input, runtime));
        return state.turn_id && state.run_id && state.request_id && state.trace_id && state.root_span_id && state.root_event_id ? state : undefined;
    }
    catch {
        return undefined;
    }
}
function writeNativeTurnState(input, runtime, state) {
    const target = nativeTurnStatePath(input, runtime);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(state) + "\n", { mode: 0o600 });
    fs.renameSync(temporary, target);
}
function clearNativeTurnState(input, runtime) {
    try {
        fs.unlinkSync(nativeTurnStatePath(input, runtime));
    }
    catch (error) {
        if (error?.code !== "ENOENT")
            throw error;
    }
}
function prepareTurnScopedTraceInput(input, event, runtime) {
    if (!TURN_SCOPED_RUNTIMES.has(runtime))
        return input;
    if (event === "SessionStart") {
        clearNativeTurnState(input, runtime);
        return input;
    }
    if (event === "UserPromptSubmit") {
        const turnId = boundedId(firstPresent(input.turn_id, input.turnId)) || `turn_${runtimeSlug(runtime)}_${crypto.randomUUID()}`;
        const enriched = { ...input, turn_id: turnId };
        const rootEventId = nativeEventId(enriched, event, runtime);
        const state = {
            session_id: safeSessionId(enriched),
            turn_id: turnId,
            run_id: runIdFor(enriched, runtime),
            request_id: requestIdFor(enriched, runtime),
            trace_id: crypto.randomBytes(16).toString("hex"),
            root_span_id: crypto.randomBytes(8).toString("hex"),
            root_event_id: rootEventId,
            tool_spans: {},
            updated_at: new Date().toISOString(),
        };
        writeNativeTurnState(input, runtime, state);
        return {
            ...enriched,
            run_id: state.run_id,
            request_id: state.request_id,
            trace_id: state.trace_id,
            span_id: state.root_span_id,
            root_event_id: state.root_event_id,
        };
    }
    const state = readNativeTurnState(input, runtime);
    if (!state)
        return input;
    const callId = toolCallId(input, runtime);
    let spanId;
    if (TOOL_LIFECYCLE_EVENTS.has(event) && callId) {
        spanId = state.tool_spans[callId] || crypto.randomBytes(8).toString("hex");
        if (!state.tool_spans[callId]) {
            state.tool_spans[callId] = spanId;
            state.updated_at = new Date().toISOString();
            writeNativeTurnState(input, runtime, state);
        }
    }
    else {
        spanId = crypto.createHash("sha256").update(`${state.trace_id}:${event}:${eventInputId(input) || "event"}`).digest("hex").slice(0, 16);
    }
    return {
        ...input,
        turn_id: state.turn_id,
        run_id: state.run_id,
        request_id: state.request_id,
        trace_id: state.trace_id,
        span_id: spanId,
        parent_span_id: event === "UserPromptSubmit" ? undefined : state.root_span_id,
        root_event_id: state.root_event_id,
        traceparent: `00-${state.trace_id}-${state.root_span_id}-01`,
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
function removeHeader(headers, name) {
    const prefix = `${name.toLowerCase()}:`;
    for (let index = headers.length - 1; index >= 0; index -= 1) {
        if (headers[index].toLowerCase().startsWith(prefix))
            headers.splice(index, 1);
    }
}
function observedCommandEnv(runtime, ids, activeGoal) {
    const env = {
        ...process.env,
        TE_REQUEST_ID: TURN_SCOPED_RUNTIMES.has(runtime) ? undefined : ids.requestId,
        TE_RUN_ID: TURN_SCOPED_RUNTIMES.has(runtime) ? undefined : ids.runId,
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
        if (TURN_SCOPED_RUNTIMES.has(runtime)) {
            removeHeader(headers, "X-TE-Request-ID");
            removeHeader(headers, "X-TE-Run-ID");
        }
        upsertHeader(headers, "X-TE-Request-ID", TURN_SCOPED_RUNTIMES.has(runtime) ? undefined : ids.requestId);
        upsertHeader(headers, "X-TE-Run-ID", TURN_SCOPED_RUNTIMES.has(runtime) ? undefined : ids.runId);
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
            .filter((command) => isGuardHookCommand(command, "claude-code"));
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
function installedCodexHookCommands(settings) {
    return CODEX_HOOK_EVENTS.flatMap((event) => {
        const entries = Array.isArray(settings.hooks?.[event]) ? settings.hooks[event] : [];
        return entries.flatMap((entry) => (Array.isArray(entry?.hooks) ? entry.hooks : [])
            .map((hook) => String(hook?.command || hook || ""))
            .filter((command) => isGuardHookCommand(command, "codex")));
    });
}
function activeTeCommand() {
    const lookup = process.platform === "win32"
        ? (0, child_process_1.spawnSync)("where", ["te"], { encoding: "utf8", shell: true })
        : (0, child_process_1.spawnSync)("sh", ["-lc", "command -v te"], { encoding: "utf8" });
    const executable = lookup.status === 0 ? lookup.stdout.trim().split(/\r?\n/)[0] : undefined;
    if (!executable)
        return {};
    const version = (0, child_process_1.spawnSync)(executable, ["--version"], { encoding: "utf8" });
    return { path: executable, version: version.status === 0 ? version.stdout.trim() : undefined };
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
    const requiredEvents = ["UserPromptSubmit", "PreToolUse", "PostToolUse"];
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
    config.plugin = Array.isArray(config.plugin) ? config.plugin : [config.plugin].filter(Boolean);
    const pluginRef = "./.opencode/plugins/tuning-engines.js";
    config.plugin = config.plugin.filter((entry) => String(entry) !== "opencode-helicone-session");
    if (!config.plugin.includes(pluginRef))
        config.plugin.push(pluginRef);
    writeJsonFile(configPath, config);
    const pluginPath = path.join(projectDir, ".opencode", "plugins", "tuning-engines.js");
    fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
    fs.writeFileSync(pluginPath, openCodePluginSource(), { mode: 0o600 });
    const commandPath = path.join(projectDir, ".opencode", "commands", "te-goal.md");
    fs.mkdirSync(path.dirname(commandPath), { recursive: true });
    fs.writeFileSync(commandPath, "---\ndescription: Label the desired Tuning Engines outcome\n---\n\nRun `te goal start \"$ARGUMENTS\"` in the project terminal, then continue the work. Record the result with `te goal complete --result succeeded` when finished.\n", { mode: 0o600 });
    return [configPath, pluginPath, commandPath];
}
function openCodePluginSource() {
    return `import { spawnSync } from "node:child_process";

function emit(event, payload = {}) {
  try {
    const result = spawnSync("te", ["guard", "opencode", "hook", "--event", event], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      stdio: ["pipe", "ignore", "ignore"],
      timeout: 30000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function withSession(input) {
  const session = input?.session || {};
  return {
    ...input,
    session_id: input?.session_id || session.id || input?.sessionID,
    conversation_id: input?.conversation_id || session.id,
    cwd: input?.cwd || session.cwd || process.cwd(),
  };
}

export const TuningEnginesPlugin = async () => ({
  event: async ({ event }) => {
    if (event?.type === "session.created") emit("session.created", withSession(event.properties || event));
    if (event?.type === "session.idle") emit("session.idle", withSession(event.properties || event));
    if (event?.type === "session.error") emit("session.error", withSession({ ...(event.properties || event), error: event.error || event.properties?.error }));
  },
  "permission.asked": async (input) => {
    emit("permission.asked", withSession(input));
  },
  "permission.replied": async (input) => {
    const granted = Boolean(input?.granted ?? input?.approved ?? input?.allowed);
    emit(granted ? "approval.approved" : "approval.denied", withSession({ ...input, granted }));
  },
  "tool.execute.before": async (input) => {
    emit("tool.execute.before", withSession(input));
  },
  "tool.execute.after": async (input) => {
    emit("tool.execute.after", withSession(input));
  },
});

export default TuningEnginesPlugin;
`;
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
    const input = { session_id: ids.sessionId };
    const lifecycleEvent = eventStatusValue === "started" ? "SessionStart" : "SessionEnd";
    const nativeMetadata = nativeEventMetadata(input, lifecycleEvent, runtime);
    await client.createTrace({
        run_id: ids.runId,
        request_id: ids.requestId,
        name: `${traceRuntimeLabel(runtime)} session`,
        runtime,
        telemetry_source: "sidecar",
        status,
        metadata: {
            request_id: ids.requestId,
            run_id: ids.runId,
            session_id: ids.sessionId,
            conversation_id: ids.sessionId,
            thread_id: ids.sessionId,
            ...nativeMetadata,
            framework: runtime,
            source: "te_guard_run",
            telemetry_source: "sidecar",
            exit_code: exitCode,
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
                    ...nativeMetadata,
                    exit_code: exitCode,
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
    const nativeMetadata = nativeEventMetadata(input, event, runtime);
    const failure = hookFailureData(input);
    const turnFinished = event === "Stop" || event === "StopFailure" || event === "SessionEnd";
    const runStatus = turnFinished ? (failure.failed || event === "StopFailure" ? "failed" : "succeeded") : "running";
    await client.createTrace({
        run_id: runId,
        request_id: requestId,
        name: `${traceRuntimeLabel(runtime)} turn`,
        runtime,
        telemetry_source: "sidecar",
        status: runStatus,
        ended_at: turnFinished ? now : undefined,
        metadata: {
            request_id: requestId,
            run_id: runId,
            telemetry_source: "sidecar",
            session_id: safeSessionId(input),
            conversation_id: safeThreadId(input),
            thread_id: safeThreadId(input),
            turn_id: nativeMetadata.turn_id,
            task_id: nativeMetadata.task_id,
            parent_task_id: nativeMetadata.parent_task_id,
            tool_call_id: nativeMetadata.tool_call_id,
            human_summary: nativeMetadata.human_summary,
            te_display_summary: nativeMetadata.te_display_summary,
            error: nativeMetadata.error,
            exit_code: nativeMetadata.exit_code,
            ...nativeMetadata,
        },
        events: [
            {
                id: nativeEventId(input, event, runtime),
                parent_id: nativeParentEventId(input, event, runtime),
                type: eventType(event),
                status: statusForEvent(input, event, decision),
                at: now,
                metadata: compact({
                    request_id: requestId,
                    run_id: runId,
                    session_id: safeSessionId(input),
                    conversation_id: safeThreadId(input),
                    thread_id: safeThreadId(input),
                    hook_event: event,
                    phase: toolExecutionPhase(event, input) || (event === "PermissionDenied" ? "blocked" : event === "PermissionRequest" ? "proposed" : event),
                    name: nativeMetadata.operation_class || event,
                    tool_name: tool ? friendlyToolLabel(tool) : undefined,
                    tool_call_id: nativeMetadata.tool_call_id,
                    turn_id: nativeMetadata.turn_id,
                    human_summary: nativeMetadata.human_summary,
                    te_display_summary: nativeMetadata.te_display_summary,
                    error: failure.error,
                    exit_code: failure.exit_code,
                    success: failure.failed ? false : undefined,
                    ok: failure.failed ? false : undefined,
                    task_id: nativeMetadata.task_id,
                    parent_task_id: nativeMetadata.parent_task_id,
                    ...nativeMetadata,
                    decision,
                }),
                trace_id: input.trace_id,
                span_id: input.span_id,
                parent_span_id: input.parent_span_id,
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
        .option("--project <dir>", "Project directory used for native runtime hooks", process.cwd())
        .option("--no-install-hooks", "Do not install or refresh native runtime hooks before launch")
        .allowUnknownOption(true)
        .argument("[command...]", "Command to run after --")
        .action(async (commandParts, opts) => {
        if (!commandParts.length) {
            console.error("Usage: te guard run --runtime codex -- codex");
            process.exit(1);
        }
        const runtime = String(opts.runtime || "custom").replace(/-/g, "_");
        const [command, ...args] = commandParts;
        const ids = sidecarRunIds(runtime, commandParts);
        const client = getClient();
        const activeGoal = (0, goal_context_1.loadGoalContext)();
        if (runtime === "claude_code" && opts.installHooks !== false) {
            try {
                const installed = writeClaudeHooks(opts.project || process.cwd());
                if (installed.changed) {
                    console.log(`Installed Claude Code tool telemetry hooks in ${installed.settingsPath}`);
                    console.log(`Mode: ${claudeInstallModeSummary(installed.mode, installed.failOpen)}`);
                }
            }
            catch (err) {
                console.error(`Tuning Engines guard warning: Claude Code hooks could not be activated: ${err.message}`);
            }
        }
        if (!TURN_SCOPED_RUNTIMES.has(runtime)) {
            try {
                await recordSidecarRun(client, runtime, commandParts, ids, "running", "started");
            }
            catch (err) {
                console.error(`Tuning Engines guard warning: ${err.message}`);
            }
        }
        let exitCode = 0;
        try {
            exitCode = await spawnObservedCommand(command, args, observedCommandEnv(runtime, ids, activeGoal));
        }
        catch (err) {
            console.error(`Observed command failed to start: ${err.message}`);
            exitCode = 127;
        }
        if (!TURN_SCOPED_RUNTIMES.has(runtime)) {
            try {
                await recordSidecarRun(client, runtime, commandParts, ids, exitCode === 0 ? "succeeded" : "failed", exitCode === 0 ? "succeeded" : "failed", exitCode);
            }
            catch (err) {
                console.error(`Tuning Engines guard warning: ${err.message}`);
            }
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
            const rawInput = safeJsonParse(await readStdin());
            const event = hookEvent(rawInput, opts.event);
            currentEvent = event;
            input = prepareTurnScopedTraceInput(rawInput, event, "claude_code");
            const client = getClient();
            let decision;
            if (event === "PreToolUse") {
                decision = await evaluatePreToolUse(client, input, event, mode);
            }
            if (event !== "SessionStart")
                await recordTrace(client, input, event, decision);
            appendClaudeHookStatusForInput(input, event, "uploaded");
            if (event === "SessionEnd")
                clearNativeTurnState(rawInput, "claude_code");
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
            console.log(`Hook CLI: ${resolvedCliEntrypoint()} (${version_1.CLI_VERSION}, ${NATIVE_EVENT_CONTRACT_VERSION})`);
            console.log("Review and trust the project hooks from Codex /hooks before relying on native goal telemetry.");
            console.log("Native /goal declarations will appear in Inference > Work Sessions.");
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    codex
        .command("doctor")
        .description("Check Codex hook version, command path, and turn-trace installation")
        .option("--project <dir>", "Project directory", process.cwd())
        .option("--global", "Check ~/.codex/hooks.json instead of project-local .codex/hooks.json")
        .option("--json", "Output as JSON")
        .action((opts) => {
        try {
            const projectDir = path.resolve(opts.project);
            const settingsPath = opts.global
                ? path.join(process.env.HOME || process.cwd(), ".codex", "hooks.json")
                : path.join(projectDir, ".codex", "hooks.json");
            const settings = readJsonFile(settingsPath);
            const commands = installedCodexHookCommands(settings);
            const expectedEntrypoint = resolvedCliEntrypoint();
            const requiredEvents = ["UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "SessionEnd"];
            const missingEvents = requiredEvents.filter((event) => {
                const entries = Array.isArray(settings.hooks?.[event]) ? settings.hooks[event] : [];
                return !entries.some((entry) => (Array.isArray(entry?.hooks) ? entry.hooks : [])
                    .some((hook) => isGuardHookCommand(hook?.command || hook, "codex")));
            });
            const staleCommands = commands.filter((command) => !command.includes(expectedEntrypoint));
            const active = activeTeCommand();
            const checks = [
                {
                    level: fs.existsSync(settingsPath) ? "ok" : "fail",
                    check: "Codex hooks file",
                    detail: settingsPath,
                },
                {
                    level: missingEvents.length ? "fail" : "ok",
                    check: "Turn lifecycle hooks",
                    detail: missingEvents.length ? `Missing: ${missingEvents.join(", ")}` : `Present: ${requiredEvents.join(", ")}`,
                },
                {
                    level: staleCommands.length ? "fail" : "ok",
                    check: "Pinned hook entrypoint",
                    detail: staleCommands.length
                        ? `${staleCommands.length} hook command(s) do not use ${expectedEntrypoint}. Reinstall hooks.`
                        : expectedEntrypoint,
                },
                {
                    level: active.version === version_1.CLI_VERSION ? "ok" : "warn",
                    check: "Active te command",
                    detail: active.path ? `${active.path} reports ${active.version || "unknown"}; installer reports ${version_1.CLI_VERSION}.` : "te is not available on PATH.",
                },
                {
                    level: "ok",
                    check: "Native event contract",
                    detail: NATIVE_EVENT_CONTRACT_VERSION,
                },
            ];
            const ok = checks.every((check) => check.level !== "fail");
            if (opts.json) {
                output.json({ ok, cli_version: version_1.CLI_VERSION, native_event_contract_version: NATIVE_EVENT_CONTRACT_VERSION, settings_path: settingsPath, expected_entrypoint: expectedEntrypoint, active_te: active, checks });
            }
            else {
                console.log("Codex hook doctor");
                for (const row of checks) {
                    const marker = row.level === "ok" ? "OK" : row.level === "warn" ? "WARN" : "FAIL";
                    console.log(`[${marker}] ${row.check}: ${row.detail}`);
                }
            }
            if (!ok)
                process.exit(1);
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
            const rawInput = safeJsonParse(await readStdin());
            const event = hookEvent(rawInput, opts.event);
            const input = prepareTurnScopedTraceInput(rawInput, event, "codex");
            if (event !== "SessionStart")
                await recordTrace(getClient(), input, event, undefined, "codex");
            if (event === "SessionEnd")
                clearNativeTurnState(rawInput, "codex");
        }
        catch (err) {
            console.error(`Tuning Engines Codex telemetry warning: ${err.message}`);
        }
    });
    opencode.command("install").description("Install OpenCode session tracking and /te-goal helper")
        .option("--project <dir>", "Project directory", process.cwd()).action((opts) => {
        try {
            const paths = installOpenCode(path.resolve(opts.project));
            console.log(`Installed OpenCode native tracking in ${paths.join(" and ")}`);
            console.log("OpenCode will load the local Tuning Engines plugin on startup and emit tool, permission, and session evidence.");
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    opencode.command("hook").description("OpenCode plugin hook entrypoint. Reads hook JSON from stdin.")
        .option("--event <event>", "OpenCode hook event name").action(async (opts) => {
        try {
            const input = safeJsonParse(await readStdin());
            await recordTrace(getClient(), input, hookEvent(input, opts.event), undefined, "opencode");
        }
        catch (err) {
            console.error(`Tuning Engines OpenCode telemetry warning: ${err.message}`);
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