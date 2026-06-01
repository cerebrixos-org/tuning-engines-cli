#!/usr/bin/env node

import { Command } from "commander";
import { TuningEnginesClient } from "./client";
import { getApiKey, getApiUrl } from "./config";
import { CLI_VERSION } from "./version";
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
import { registerOutcomeCommands } from "./commands/outcomes";
import { registerInsightCommands } from "./commands/insights";
import { registerDoctorCommands } from "./commands/doctor";
import { registerPolicyDecisionCommands } from "./commands/policy-decisions";
import { registerPolicyDraftCommands, registerPolicyTemplateCommands } from "./commands/policy-templates";
import { registerOrchestrationCommands } from "./commands/orchestration";
import { registerInterventionCommands } from "./commands/interventions";
import { registerStateCommands } from "./commands/state";
import { registerRegistryCommands } from "./commands/registry";
import { registerBulkImportCommands } from "./commands/bulk-import";
import { registerFileCommands } from "./commands/files";
import { registerMcpToolCommands } from "./commands/mcp-tools";
import { registerGuardCommands } from "./commands/guard";
import { registerGoalCommands } from "./commands/goal";

const program = new Command();

program
  .name("te")
  .description("Tuning Engines CLI — fine-tune LLMs and browse the Marketplace from your terminal")
  .version(CLI_VERSION);

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
registerOutcomeCommands(program, getClient);
registerInsightCommands(program, getClient);
registerDoctorCommands(program, getClient);
registerInterventionCommands(program, getClient);
registerStateCommands(program, getClient);
registerRegistryCommands(program, getClient);
registerBulkImportCommands(program, getClient);
registerFileCommands(program, getClient);
registerPolicyDecisionCommands(program, getClient);
registerPolicyTemplateCommands(program, getClient);
registerPolicyDraftCommands(program, getClient);
registerOrchestrationCommands(program);
registerGuardCommands(program, getClient);
registerGoalCommands(program, getClient);

// MCP server subcommand
const mcp = program
  .command("mcp")
  .description("MCP server for AI assistant integration and registry tool operations");

registerMcpToolCommands(mcp, getClient);

mcp
  .command("serve")
  .description("Start the MCP server (stdio transport)")
  .option("--enable-registry-writes", "Enable MCP tools that write registry/review telemetry")
  .action(async (opts) => {
    // Dynamic import to avoid loading MCP dependencies for non-MCP commands
    const { startMcpServer } = await import("./mcp");
    await startMcpServer({ enableRegistryWrites: Boolean(opts.enableRegistryWrites) });
  });

program.parse();
