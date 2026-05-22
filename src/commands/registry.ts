import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

type TemplateKind = "langgraph" | "temporal" | "mcp";

export function registerRegistryCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const registry = program
    .command("registry")
    .description("Sync MCP servers, tenant agents, and tenant skills from manifests");

  registry
    .command("template <kind>")
    .description("Print a registry manifest template: langgraph, temporal, or mcp")
    .action((kind: string) => {
      const normalized = kind.toLowerCase() as TemplateKind;
      if (!["langgraph", "temporal", "mcp"].includes(normalized)) {
        console.error("kind must be one of: langgraph, temporal, mcp");
        process.exit(1);
      }
      console.log(registryTemplate(normalized));
    });

  registry
    .command("sync")
    .description("Dry-run or apply a registry manifest")
    .requiredOption("--file <path>", "YAML or JSON manifest path")
    .option("--dry-run", "Show diff without mutating resources")
    .option("--apply", "Apply manifest changes")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        if (opts.dryRun && opts.apply) {
          throw new Error("Choose only one of --dry-run or --apply");
        }
        const manifest = readManifest(opts.file);
        const result = opts.apply
          ? await getClient().applyRegistrySync(manifest)
          : await getClient().dryRunRegistrySync(manifest);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}

function readManifest(filePath: string): Record<string, any> {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, "utf8");
  const parsed = YAML.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Registry manifest must be a YAML or JSON object");
  }
  return parsed;
}

function printResult(result: any, asJson: boolean): void {
  if (asJson) {
    output.json(result);
    return;
  }
  output.json(result);
}

function registryTemplate(kind: TemplateKind): string {
  const source = kind;
  const mcpUrl = kind === "mcp" ? "https://mcp.example/sse" : `https://${kind}.example/mcp/sse`;
  return `version: 1
source: ${source}
resources:
  mcp_servers:
    - name: ${kind}-tools
      external_ref: mcp.${kind}.tools
      description: ${kind} MCP tools exposed to governed inference
      url: ${mcpUrl}
      transport: sse
      auth_method: none
      enabled: true
      tags:
        - ${kind}
  tenant_agents:
    - name: ${kind}-agent
      external_ref: agent.${kind}.default
      description: Governed ${kind} agent endpoint
      url: https://${kind}.example/agents/default
      auth_method: none
      enabled: true
      framework:
        name: ${kind}
  tenant_skills:
    - name: ${kind}-summarizer
      external_ref: skill.${kind}.summarizer
      description: Summarize ${kind} runtime context
      source_url: https://${kind}.example/skills/summarizer
      domain: ${kind}
      auth_method: none
      enabled: true
`;
}
