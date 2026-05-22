import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

const BLOCKED_SECRET_FIELD_NAMES = new Set<string>([
  "api_key",
  "access_token",
  "refresh_token",
  "password",
  "private_key",
  "client_secret",
  "secret",
  "token",
]);

function parseJsonObject(raw?: string, optionName = "--params"): Record<string, any> {
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${optionName} must be a JSON object`);
  }
  return parsed;
}

function hasBlockedSecretField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasBlockedSecretField(item));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    if (BLOCKED_SECRET_FIELD_NAMES.has(key.toLowerCase())) return true;
    return hasBlockedSecretField(nested);
  });
}

function hasBlockedSecretText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /\b(sk-te-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{12,}|te_[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16})\b/i.test(value) ||
    /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|private[_-]?key|client[_-]?secret|secret)\b\s*[:=]/i.test(value);
}

function printResult(result: any, asJson: boolean): void {
  output.json(result);
}

export function registerPolicyTemplateCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
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
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  templates
    .command("render <id>")
    .description("Render a policy template into disabled/shadow AGT YAML")
    .option("--params <json>", "Template parameters as a JSON object", "{}")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const params = parseJsonObject(opts.params);
        if (hasBlockedSecretField(params)) {
          throw new Error("Template parameters appear to contain raw secret fields. Remove secrets before rendering.");
        }
        const result = await getClient().renderPolicyTemplate(id, params);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}

export function registerPolicyDraftCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
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
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
