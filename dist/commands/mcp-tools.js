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
exports.registerMcpToolCommands = registerMcpToolCommands;
const inference_request_1 = require("../inference_request");
const output = __importStar(require("../output"));
function printResult(result, asJson) {
    if (asJson) {
        output.json(result);
        return;
    }
    output.json(result);
}
function registerMcpToolCommands(mcp, getClient) {
    mcp
        .command("rediscover <server-id>")
        .description("Queue MCP tools/list discovery for a tenant-owned MCP server")
        .option("--json", "Output as JSON")
        .action(async (serverId, opts) => {
        try {
            printResult(await getClient().rediscoverMcpServer(serverId), opts.json);
        }
        catch (err) {
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
            const bearer = await (0, inference_request_1.resolveInferenceBearer)(getClient(), opts.key);
            printResult(await (0, inference_request_1.callInference)("/mcp/tools/call", {
                server_name: opts.server,
                tool_name: opts.tool,
                arguments: (0, inference_request_1.parseJsonObject)(opts.arguments, "arguments"),
            }, bearer, { baseUrl: opts.baseUrl }), opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    const templates = mcp.command("templates").description("Browse and install verified MCP templates");
    templates.command("list")
        .action(async () => {
        try {
            printResult(await getClient().listMcpTemplates(), true);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    templates.command("show <id>")
        .action(async (id) => {
        try {
            printResult(await getClient().getMcpTemplate(id), true);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    templates.command("install <id>")
        .description("Install a verified template as a disabled MCP server")
        .option("--secret-reference-id <id>", "Existing tenant secret reference")
        .action(async (id, opts) => {
        try {
            printResult(await getClient().installMcpTemplate(id, opts.secretReferenceId), true);
        }
        catch (err) {
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
        .action(async (serverId, opts) => {
        try {
            const result = await getClient().listMcpTools(serverId, {
                limit: Number(opts.limit),
                offset: Number(opts.offset),
            });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    tools
        .command("enable <server-id> <tool-id>")
        .description("Enable a discovered MCP tool")
        .option("--json", "Output as JSON")
        .action(async (serverId, toolId, opts) => {
        try {
            printResult(await getClient().updateMcpTool(serverId, toolId, { enabled: true }), opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    tools
        .command("disable <server-id> <tool-id>")
        .description("Disable a discovered MCP tool")
        .option("--json", "Output as JSON")
        .action(async (serverId, toolId, opts) => {
        try {
            printResult(await getClient().updateMcpTool(serverId, toolId, { enabled: false }), opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    tools
        .command("toggle <server-id> <tool-id>")
        .description("Toggle a discovered MCP tool")
        .option("--json", "Output as JSON")
        .action(async (serverId, toolId, opts) => {
        try {
            printResult(await getClient().toggleMcpTool(serverId, toolId), opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=mcp-tools.js.map