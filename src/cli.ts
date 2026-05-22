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
import { registerDatasetCommands } from "./commands/datasets";
import { registerEvaluationCommands } from "./commands/evaluations";
import { registerInferenceCommands } from "./commands/inference";
import { registerAgentCommands } from "./commands/agents";
import { registerTenantCommands } from "./commands/tenant";
import { registerApprovalCommands } from "./commands/approvals";
import { registerTraceCommands } from "./commands/traces";
import { registerPolicyDecisionCommands } from "./commands/policy-decisions";
import { registerOrchestrationCommands } from "./commands/orchestration";

const program = new Command();

program
  .name("te")
  .description("Tuning Engines CLI — fine-tune LLMs and browse the Marketplace from your terminal")
  .version("0.4.6");

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
registerDatasetCommands(program, getClient);
registerEvaluationCommands(program, getClient);
registerInferenceCommands(program, getClient);
registerAgentCommands(program, getClient);
registerTenantCommands(program, getClient);
registerApprovalCommands(program, getClient);
registerTraceCommands(program, getClient);
registerPolicyDecisionCommands(program, getClient);
registerOrchestrationCommands(program);

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
