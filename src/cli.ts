#!/usr/bin/env node

import { Command } from "commander";
import { TuningEnginesClient } from "./client";
import { getApiKey, getApiUrl } from "./config";
import { registerConfigCommands } from "./commands/config";
import { registerJobCommands } from "./commands/jobs";
import { registerModelCommands } from "./commands/models";
import { registerBillingCommands } from "./commands/billing";
import { registerAccountCommands } from "./commands/account";
import { registerAuthCommands } from "./commands/auth";
import { registerCatalogCommands } from "./commands/catalog";

const program = new Command();

program
  .name("te")
  .description("Tuning Engines CLI — fine-tune LLMs and browse the Marketplace from your terminal")
  .version("0.3.5");

// Lazy client initialization (only when a command actually needs it)
const getClient = (): TuningEnginesClient => {
  return new TuningEnginesClient({
    apiKey: getApiKey(),
    apiUrl: getApiUrl(),
  });
};

// Register all command groups
registerAuthCommands(program);
registerConfigCommands(program);
registerJobCommands(program, getClient);
registerModelCommands(program, getClient);
registerBillingCommands(program, getClient);
registerAccountCommands(program, getClient);
registerCatalogCommands(program, getClient);

// MCP server subcommand
program
  .command("mcp")
  .description("MCP server for AI assistant integration")
  .command("serve")
  .description("Start the MCP server (stdio transport)")
  .action(async () => {
    // Dynamic import to avoid loading MCP dependencies for non-MCP commands
    const { startMcpServer } = await import("./mcp");
    await startMcpServer();
  });

program.parse();
