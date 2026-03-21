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
const config_2 = require("./commands/config");
const jobs_1 = require("./commands/jobs");
const models_1 = require("./commands/models");
const billing_1 = require("./commands/billing");
const account_1 = require("./commands/account");
const auth_1 = require("./commands/auth");
const catalog_1 = require("./commands/catalog");
const program = new commander_1.Command();
program
    .name("te")
    .description("Tuning Engines CLI — fine-tune LLMs and browse the Marketplace from your terminal")
    .version("0.3.5");
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
// MCP server subcommand
program
    .command("mcp")
    .description("MCP server for AI assistant integration")
    .command("serve")
    .description("Start the MCP server (stdio transport)")
    .action(async () => {
    // Dynamic import to avoid loading MCP dependencies for non-MCP commands
    const { startMcpServer } = await Promise.resolve().then(() => __importStar(require("./mcp")));
    await startMcpServer();
});
program.parse();
//# sourceMappingURL=cli.js.map