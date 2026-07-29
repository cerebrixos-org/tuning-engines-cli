import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import { callInference, parseJsonObject, resolveInferenceBearer } from "../inference_request";
import * as output from "../output";

function printResult(result: any, asJson: boolean): void {
  if (asJson) {
    output.json(result);
    return;
  }
  output.json(result);
}

export function registerMcpToolCommands(
  mcp: Command,
  getClient: () => TuningEnginesClient
): void {
  mcp
    .command("rediscover <server-id>")
    .description("Queue MCP tools/list discovery for a tenant-owned MCP server")
    .option("--json", "Output as JSON")
    .action(async (serverId: string, opts) => {
      try {
        printResult(await getClient().rediscoverMcpServer(serverId), opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  mcp
    .command("call")
    .description("Call an enabled governed MCP tool through the inference gateway")
    .requiredOption("--server <name>", "Registered MCP server name")
    .requiredOption("--tool <name>", "Tool name")
    .option("--arguments <json>", "Tool arguments JSON", "{}")
    .option("--key <key>", "Inference key; defaults to TE_INFERENCE_KEY or a short-lived JWT")
    .option("--base-url <url>", "Inference base URL; defaults to TE_INFERENCE_URL")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const bearer = await resolveInferenceBearer(getClient(), opts.key);
        printResult(await callInference("/mcp/tools/call", {
          server_name: opts.server,
          tool_name: opts.tool,
          arguments: parseJsonObject(opts.arguments, "arguments"),
        }, bearer, { baseUrl: opts.baseUrl }), opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  const templates = mcp.command("templates").description("Browse and install verified MCP templates");
  templates.command("list")
    .action(async () => {
      try {
        printResult(await getClient().listMcpTemplates(), true);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
  templates.command("show <id>")
    .action(async (id: string) => {
      try {
        printResult(await getClient().getMcpTemplate(id), true);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
  templates.command("install <id>")
    .description("Install a verified template as a disabled MCP server")
    .option("--secret-reference-id <id>", "Existing tenant secret reference")
    .action(async (id: string, opts) => {
      try {
        printResult(await getClient().installMcpTemplate(id, opts.secretReferenceId), true);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  const tools = mcp
    .command("tools")
    .description("List and enable/disable discovered MCP tools");

  tools
    .command("list <server-id>")
    .description("List discovered tools for an MCP server")
    .option("-l, --limit <n>", "Max results", "100")
    .option("--offset <n>", "Offset", "0")
    .option("--json", "Output as JSON")
    .action(async (serverId: string, opts) => {
      try {
        const result = await getClient().listMcpTools(serverId, {
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  tools
    .command("enable <server-id> <tool-id>")
    .description("Enable a discovered MCP tool")
    .option("--json", "Output as JSON")
    .action(async (serverId: string, toolId: string, opts) => {
      try {
        printResult(await getClient().updateMcpTool(serverId, toolId, { enabled: true }), opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  tools
    .command("disable <server-id> <tool-id>")
    .description("Disable a discovered MCP tool")
    .option("--json", "Output as JSON")
    .action(async (serverId: string, toolId: string, opts) => {
      try {
        printResult(await getClient().updateMcpTool(serverId, toolId, { enabled: false }), opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  tools
    .command("toggle <server-id> <tool-id>")
    .description("Toggle a discovered MCP tool")
    .option("--json", "Output as JSON")
    .action(async (serverId: string, toolId: string, opts) => {
      try {
        printResult(await getClient().toggleMcpTool(serverId, toolId), opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
