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
exports.registerInterventionCommands = registerInterventionCommands;
const output = __importStar(require("../output"));
function registerInterventionCommands(program, getClient) {
    const interventions = program
        .command("interventions")
        .description("Poll and update runtime pause/resume/cancel/replay requests");
    interventions
        .command("list")
        .description("List runtime intervention requests")
        .option("--run-id <id>", "Filter by run_id")
        .option("--status <status>", "Filter by status")
        .option("--kind <kind>", "Filter by kind: pause, resume, cancel, replay")
        .option("-l, --limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const result = await getClient().listRuntimeInterventions({
                runId: opts.runId,
                status: opts.status,
                kind: opts.kind,
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
    interventions
        .command("request <run-id>")
        .description("Create a runtime intervention request as a tenant owner/admin")
        .requiredOption("--kind <kind>", "pause, resume, cancel, or replay")
        .option("--reason <text>", "Reason for the request")
        .option("--target-event-id <id>", "Specific event to replay/retry from")
        .option("--metadata <json>", "Optional JSON metadata")
        .option("--json", "Output as JSON")
        .action(async (runId, opts) => {
        try {
            const result = await getClient().createRuntimeIntervention(runId, {
                kind: opts.kind,
                reason: opts.reason,
                target_event_id: opts.targetEventId,
                metadata: parseJsonObject(opts.metadata),
            });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    interventions
        .command("ack <id>")
        .description("Acknowledge an intervention from a runtime adapter")
        .option("--metadata <json>", "Optional JSON metadata")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => runLifecycle("ack", getClient, id, opts));
    interventions
        .command("complete <id>")
        .description("Mark an intervention completed")
        .option("--metadata <json>", "Optional JSON metadata")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => runLifecycle("complete", getClient, id, opts));
    interventions
        .command("fail <id>")
        .description("Mark an intervention failed")
        .option("--metadata <json>", "Optional JSON metadata")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => runLifecycle("fail", getClient, id, opts));
}
async function runLifecycle(action, getClient, id, opts) {
    try {
        const metadata = parseJsonObject(opts.metadata);
        const client = getClient();
        const result = action === "ack"
            ? await client.ackRuntimeIntervention(id, metadata)
            : action === "complete"
                ? await client.completeRuntimeIntervention(id, metadata)
                : await client.failRuntimeIntervention(id, metadata);
        printResult(result, opts.json);
    }
    catch (err) {
        console.error(err.message);
        process.exit(1);
    }
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
//# sourceMappingURL=interventions.js.map