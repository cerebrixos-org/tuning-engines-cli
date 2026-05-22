import { Command } from "commander";
import { TuningEnginesClient } from "../client";
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
