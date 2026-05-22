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
exports.registerStateCommands = registerStateCommands;
const output = __importStar(require("../output"));
function registerStateCommands(program, getClient) {
    const state = program
        .command("state")
        .description("Manage external runtime state and memory references");
    state
        .command("list")
        .description("List runtime state references")
        .option("--run-id <id>", "Filter by run_id")
        .option("--type <type>", "Reference type")
        .option("--provider <provider>", "Provider")
        .option("--resource-type <type>", "Resource type")
        .option("-l, --limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const result = await getClient().listRuntimeStateReferences({
                runId: opts.runId,
                referenceType: opts.type,
                provider: opts.provider,
                resourceType: opts.resourceType,
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
    state
        .command("upsert")
        .description("Create or update a safe pointer to external runtime state")
        .requiredOption("--type <type>", "langgraph_checkpoint, temporal_workflow, vector_namespace, memory_record, external_context")
        .requiredOption("--external-id <id>", "External id or namespace")
        .option("--run-id <id>", "Associated run_id")
        .option("--provider <provider>", "Provider")
        .option("--uri <uri>", "Safe URI or key reference")
        .option("--runtime <runtime>", "langgraph, temporal, or custom")
        .option("--resource-type <type>", "Resource type")
        .option("--resource-id <id>", "Resource id")
        .option("--resource-name <name>", "Resource name")
        .option("--status <status>", "active, archived, stale, failed")
        .option("--metadata <json>", "Optional JSON metadata")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const result = await getClient().upsertRuntimeStateReference({
                reference_type: opts.type,
                external_id: opts.externalId,
                run_id: opts.runId,
                provider: opts.provider,
                uri: opts.uri,
                runtime: opts.runtime,
                resource_type: opts.resourceType,
                resource_id: opts.resourceId,
                resource_name: opts.resourceName,
                status: opts.status,
                metadata: parseJsonObject(opts.metadata) || {},
            });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
function parseJsonObject(raw) {
    if (!raw)
        return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("metadata must be a JSON object");
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
//# sourceMappingURL=state.js.map