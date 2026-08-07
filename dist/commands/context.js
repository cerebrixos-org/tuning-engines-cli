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
exports.registerContextCommands = registerContextCommands;
const output = __importStar(require("../output"));
function registerContextCommands(program, getClient) {
    const context = program
        .command("context")
        .description("Resolve governed, versioned context for an agent turn");
    context
        .command("resolve <query>")
        .description("Resolve authorized context; observe mode returns lineage without injecting content")
        .option("--asset <id...>", "Restrict resolution to context asset IDs")
        .option("--goal-key <key>", "Stable goal key")
        .option("--entity <value...>", "Structured entity values")
        .option("--action <action>", "Requested action")
        .option("--sensitivity <level>", "Sensitivity classification")
        .option("--request-id <id>", "Request correlation ID")
        .option("--run-id <id>", "Run correlation ID")
        .option("--json", "Output as JSON")
        .action(async (query, opts) => {
        try {
            const result = await getClient().resolveContext({
                query,
                context_asset_ids: opts.asset,
                goal_key: opts.goalKey,
                entities: opts.entity,
                action: opts.action,
                sensitivity: opts.sensitivity,
                request_id: opts.requestId,
                run_id: opts.runId,
            });
            output.json(result);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=context.js.map