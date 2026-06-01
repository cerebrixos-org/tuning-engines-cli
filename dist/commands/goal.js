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
exports.registerGoalCommands = registerGoalCommands;
const crypto_1 = require("crypto");
const goal_context_1 = require("../goal_context");
const output = __importStar(require("../output"));
function registerGoalCommands(program, getClient) {
    const goal = program.command("goal").description("Label the active outcome for this project");
    goal.command("start <title>").description("Label the desired outcome for future sessions")
        .option("--key <outcome_key>", "Stable shared outcome key").option("--json", "Output as JSON")
        .action(async (title, opts) => {
        try {
            const result = await getClient().createOutcomeContext({ title, outcome_key: opts.key, context_id: (0, crypto_1.randomUUID)() });
            const context = result.outcome_context;
            (0, goal_context_1.saveGoalContext)({ outcome_context_id: context.id, title: context.title, outcome_key: context.outcome_key, project_dir: process.cwd(), source_session_hash: (0, goal_context_1.sourceSessionHash)() });
            if (opts.json)
                output.json(result);
            else
                console.log(`Started outcome: ${context.title}\nOutcome key: ${context.outcome_key}\nTaxonomy: ${context.taxonomy_status}`);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    goal.command("set <title>").description("Replace the active desired outcome")
        .option("--key <outcome_key>", "Stable shared outcome key").action(async (title, opts) => {
        try {
            const previous = (0, goal_context_1.loadGoalContext)();
            const result = await getClient().createOutcomeContext({ title, outcome_key: opts.key, context_id: previous?.outcome_context_id || (0, crypto_1.randomUUID)() });
            const context = result.outcome_context;
            (0, goal_context_1.saveGoalContext)({ outcome_context_id: context.id, title: context.title, outcome_key: context.outcome_key, project_dir: process.cwd(), source_session_hash: (0, goal_context_1.sourceSessionHash)() });
            console.log(`Updated outcome: ${context.title}`);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    goal.command("show").description("Show the active project outcome").option("--json", "Output as JSON").action((opts) => {
        const context = (0, goal_context_1.loadGoalContext)();
        if (opts.json)
            output.json({ goal: context || null });
        else if (context)
            console.log(`${context.title}\nOutcome key: ${context.outcome_key || context.goal_key || "unlabeled"}${context.outcome_context_id ? `\nContext: ${context.outcome_context_id}` : ""}`);
        else
            console.log("No active project outcome. Start one with: te goal start \"Describe the result you want\"");
    });
    goal.command("complete").description("Record the observed result and clear local context")
        .option("--result <status>", "Observed result: succeeded, failed, partial, or unknown", "succeeded")
        .action(async (opts) => {
        try {
            const context = requireContext();
            if (context.outcome_context_id)
                await getClient().completeOutcomeContext({ context_id: context.outcome_context_id, result_status: opts.result });
            else if (context.work_item_id)
                await getClient().completeWorkItem(context.work_item_id);
            (0, goal_context_1.clearGoalContext)();
            console.log(`Completed outcome: ${context.title}\nObserved result: ${opts.result}`);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    goal.command("clear").description("Clear local outcome context without recording a result").action(() => {
        (0, goal_context_1.clearGoalContext)();
        console.log("Cleared the active local outcome.");
    });
}
function requireContext() {
    const context = (0, goal_context_1.loadGoalContext)();
    if (!context)
        throw new Error("No active project outcome. Start one with: te goal start \"Describe the result you want\"");
    return context;
}
//# sourceMappingURL=goal.js.map