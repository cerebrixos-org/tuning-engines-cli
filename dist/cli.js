#!/usr/bin/env node
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
const commander_1 = require("commander");
const client_1 = require("./client");
const config_1 = require("./config");
const version_1 = require("./version");
const config_2 = require("./commands/config");
const jobs_1 = require("./commands/jobs");
const models_1 = require("./commands/models");
const billing_1 = require("./commands/billing");
const account_1 = require("./commands/account");
const auth_1 = require("./commands/auth");
const catalog_1 = require("./commands/catalog");
const datasets_1 = require("./commands/datasets");
const evaluations_1 = require("./commands/evaluations");
const inference_1 = require("./commands/inference");
const agents_1 = require("./commands/agents");
const tenant_1 = require("./commands/tenant");
const approvals_1 = require("./commands/approvals");
const traces_1 = require("./commands/traces");
const outcomes_1 = require("./commands/outcomes");
const insights_1 = require("./commands/insights");
const doctor_1 = require("./commands/doctor");
const policy_decisions_1 = require("./commands/policy-decisions");
const policy_templates_1 = require("./commands/policy-templates");
const orchestration_1 = require("./commands/orchestration");
const interventions_1 = require("./commands/interventions");
const state_1 = require("./commands/state");
const registry_1 = require("./commands/registry");
const bulk_import_1 = require("./commands/bulk-import");
const files_1 = require("./commands/files");
const mcp_tools_1 = require("./commands/mcp-tools");
const guard_1 = require("./commands/guard");
const goal_1 = require("./commands/goal");
const program = new commander_1.Command();
program
    .name("te")
    .description("Tuning Engines CLI — fine-tune LLMs and browse the Marketplace from your terminal")
    .version(version_1.CLI_VERSION);
// Lazy client initialization (only when a command actually needs it)
const getClient = () => {
    return new client_1.TuningEnginesClient({
        apiKey: (0, config_1.getApiKey)(),
        apiUrl: (0, config_1.getApiUrl)(),
    });
};
// Register all command groups
(0, auth_1.registerAuthCommands)(program);
(0, config_2.registerConfigCommands)(program);
(0, jobs_1.registerJobCommands)(program, getClient);
(0, models_1.registerModelCommands)(program, getClient);
(0, billing_1.registerBillingCommands)(program, getClient);
(0, account_1.registerAccountCommands)(program, getClient);
(0, catalog_1.registerCatalogCommands)(program, getClient);
(0, datasets_1.registerDatasetCommands)(program, getClient);
(0, evaluations_1.registerEvaluationCommands)(program, getClient);
(0, inference_1.registerInferenceCommands)(program, getClient);
(0, agents_1.registerAgentCommands)(program, getClient);
(0, tenant_1.registerTenantCommands)(program, getClient);
(0, approvals_1.registerApprovalCommands)(program, getClient);
(0, traces_1.registerTraceCommands)(program, getClient);
(0, outcomes_1.registerOutcomeCommands)(program, getClient);
(0, insights_1.registerInsightCommands)(program, getClient);
(0, doctor_1.registerDoctorCommands)(program, getClient);
(0, interventions_1.registerInterventionCommands)(program, getClient);
(0, state_1.registerStateCommands)(program, getClient);
(0, registry_1.registerRegistryCommands)(program, getClient);
(0, bulk_import_1.registerBulkImportCommands)(program, getClient);
(0, files_1.registerFileCommands)(program, getClient);
(0, policy_decisions_1.registerPolicyDecisionCommands)(program, getClient);
(0, policy_templates_1.registerPolicyTemplateCommands)(program, getClient);
(0, policy_templates_1.registerPolicyDraftCommands)(program, getClient);
(0, orchestration_1.registerOrchestrationCommands)(program);
(0, guard_1.registerGuardCommands)(program, getClient);
(0, goal_1.registerGoalCommands)(program, getClient);
// MCP server subcommand
const mcp = program
    .command("mcp")
    .description("MCP server for AI assistant integration and registry tool operations");
(0, mcp_tools_1.registerMcpToolCommands)(mcp, getClient);
mcp
    .command("serve")
    .description("Start the MCP server (stdio transport)")
    .option("--enable-registry-writes", "Enable MCP tools that write registry/review telemetry")
    .action(async (opts) => {
    // Dynamic import to avoid loading MCP dependencies for non-MCP commands
    const { startMcpServer } = await Promise.resolve().then(() => __importStar(require("./mcp")));
    await startMcpServer({ enableRegistryWrites: Boolean(opts.enableRegistryWrites) });
});
program.parse();
//# sourceMappingURL=cli.js.map