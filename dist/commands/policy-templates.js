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
exports.registerPolicyTemplateCommands = registerPolicyTemplateCommands;
exports.registerPolicyDraftCommands = registerPolicyDraftCommands;
const output = __importStar(require("../output"));
const BLOCKED_SECRET_FIELD_NAMES = new Set([
    "api_key",
    "access_token",
    "refresh_token",
    "password",
    "private_key",
    "client_secret",
    "secret",
    "token",
]);
function parseJsonObject(raw, optionName = "--params") {
    if (!raw)
        return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${optionName} must be a JSON object`);
    }
    return parsed;
}
function hasBlockedSecretField(value) {
    if (Array.isArray(value))
        return value.some((item) => hasBlockedSecretField(item));
    if (!value || typeof value !== "object")
        return false;
    return Object.entries(value).some(([key, nested]) => {
        if (BLOCKED_SECRET_FIELD_NAMES.has(key.toLowerCase()))
            return true;
        return hasBlockedSecretField(nested);
    });
}
function hasBlockedSecretText(value) {
    if (typeof value !== "string")
        return false;
    return /\b(sk-te-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{12,}|te_[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16})\b/i.test(value) ||
        /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|private[_-]?key|client[_-]?secret|secret)\b\s*[:=]/i.test(value);
}
function printResult(result, asJson) {
    output.json(result);
}
function registerPolicyTemplateCommands(program, getClient) {
    const templates = program
        .command("policy-templates")
        .description("List and render safe AGT YAML policy templates");
    templates
        .command("list")
        .description("List curated policy templates available to tenant owners/admins")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const result = await getClient().listPolicyTemplates();
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    templates
        .command("render <id>")
        .description("Render a policy template into disabled/shadow AGT YAML")
        .option("--params <json>", "Template parameters as a JSON object", "{}")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const params = parseJsonObject(opts.params);
            if (hasBlockedSecretField(params)) {
                throw new Error("Template parameters appear to contain raw secret fields. Remove secrets before rendering.");
            }
            const result = await getClient().renderPolicyTemplate(id, params);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
function registerPolicyDraftCommands(program, getClient) {
    const drafts = program
        .command("policy-drafts")
        .description("Generate AI-assisted AGT YAML drafts that must be reviewed, tested, and saved explicitly");
    drafts
        .command("generate")
        .description("Generate a disabled/shadow AGT YAML draft from a natural-language policy request")
        .requiredOption("--prompt <text>", "Policy intent; do not include secrets")
        .option("--scope <scope>", "Optional AGT scope such as all, mcp_tool, agent, skill, or chat_tool")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            if (hasBlockedSecretText(opts.prompt)) {
                throw new Error("Prompt appears to contain a key, token, password, or secret. Remove secrets before generating a draft.");
            }
            const result = await getClient().generatePolicyDraft({
                prompt: opts.prompt,
                scope: opts.scope,
            });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=policy-templates.js.map