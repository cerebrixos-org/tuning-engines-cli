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
exports.registerWorkSessionCommands = registerWorkSessionCommands;
const output = __importStar(require("../output"));
function registerWorkSessionCommands(program, getClient) {
    const ws = program
        .command("work-sessions")
        .description("Manage work sessions (traced agent runs grouped by outcome)");
    ws.command("list")
        .description("List work sessions")
        .option("--limit <n>", "Max results", "20")
        .option("--offset <n>", "Offset for pagination", "0")
        .option("--status <status>", "Filter by status (active, completed, archived)")
        .action(async (opts) => {
        try {
            output.json(await getClient().listWorkItems({
                limit: parseInt(opts.limit),
                offset: parseInt(opts.offset),
                status: opts.status,
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    ws.command("show <id>")
        .description("Show work session details")
        .action(async (id) => {
        try {
            output.json(await getClient().getWorkItem(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    ws.command("complete <id>")
        .description("Mark a work session as completed")
        .action(async (id) => {
        try {
            output.json(await getClient().completeWorkItem(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    ws.command("confirm-outcome <id>")
        .description("Confirm the outcome of a work session")
        .requiredOption("--outcome-id <id>", "Inference outcome ID")
        .option("--result-status <status>", "Result status (succeeded, failed, partial)")
        .option("--label <label>", "Outcome label")
        .action(async (id, opts) => {
        try {
            output.json(await getClient().confirmWorkItemOutcome(id, {
                inference_outcome_id: parseInt(opts.outcomeId),
                result_status: opts.resultStatus,
                label: opts.label,
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=work-sessions.js.map