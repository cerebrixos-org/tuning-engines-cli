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
exports.registerEvaluationCommands = registerEvaluationCommands;
const output = __importStar(require("../output"));
function parseJsonObject(raw) {
    if (!raw)
        return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("--data must be a JSON object");
    }
    return parsed;
}
function printResult(result) {
    output.json(result);
}
function registerEvaluationCommands(program, getClient) {
    const evals = program
        .command("evals")
        .description("Manage model evaluations");
    evals
        .command("list")
        .description("List evaluations")
        .option("--status <status>", "Filter by status")
        .option("-l, --limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            printResult(await getClient().listEvaluations({
                status: opts.status,
                limit: Number(opts.limit),
                offset: Number(opts.offset),
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    evals
        .command("show <id>")
        .description("Show evaluation details")
        .option("--json", "Output as JSON")
        .action(async (id) => {
        try {
            printResult(await getClient().getEvaluation(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    evals
        .command("create")
        .description("Create an evaluation from JSON")
        .requiredOption("--data <json>", "JSON object with evaluation attributes")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            printResult(await getClient().createEvaluation(parseJsonObject(opts.data)));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    evals
        .command("cancel <id>")
        .description("Cancel a running evaluation")
        .option("--json", "Output as JSON")
        .action(async (id) => {
        try {
            printResult(await getClient().cancelEvaluation(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    evals
        .command("retry <id>")
        .description("Retry a failed evaluation")
        .option("--json", "Output as JSON")
        .action(async (id) => {
        try {
            printResult(await getClient().retryEvaluation(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    evals
        .command("status <id>")
        .description("Check evaluation status")
        .option("--json", "Output as JSON")
        .action(async (id) => {
        try {
            printResult(await getClient().getEvaluationStatus(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    evals
        .command("evaluators")
        .description("List available evaluators")
        .option("--json", "Output as JSON")
        .action(async () => {
        try {
            printResult(await getClient().listEvaluators());
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    evals
        .command("estimate")
        .description("Estimate evaluation cost from JSON")
        .requiredOption("--data <json>", "JSON object with evaluation attributes")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            printResult(await getClient().estimateEvaluation(parseJsonObject(opts.data)));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=evaluations.js.map