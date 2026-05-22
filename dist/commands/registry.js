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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRegistryCommands = registerRegistryCommands;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml_1 = __importDefault(require("yaml"));
const output = __importStar(require("../output"));
function registerRegistryCommands(program, getClient) {
    const registry = program
        .command("registry")
        .description("Sync MCP servers, tenant agents, and tenant skills from manifests");
    registry
        .command("template <kind>")
        .description("Print a registry manifest template: langgraph, temporal, or mcp")
        .action((kind) => {
        const normalized = kind.toLowerCase();
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
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
function readManifest(filePath) {
    const resolved = path.resolve(filePath);
    const content = fs.readFileSync(resolved, "utf8");
    const parsed = yaml_1.default.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Registry manifest must be a YAML or JSON object");
    }
    return parsed;
}
function printResult(result, asJson) {
    if (asJson) {
        output.json(result);
        return;
    }
    output.json(result);
}
function registryTemplate(kind) {
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
//# sourceMappingURL=registry.js.map