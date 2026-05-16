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
exports.registerInferenceCommands = registerInferenceCommands;
const output = __importStar(require("../output"));
function printResult(result) {
    output.json(result);
}
function registerInferenceCommands(program, getClient) {
    const inference = program
        .command("inference")
        .description("Inspect inference models, usage, and direct API access");
    inference
        .command("models")
        .description("List available inference models")
        .option("--json", "Output as JSON")
        .action(async () => {
        try {
            printResult(await getClient().listInferenceModels());
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    inference
        .command("usage")
        .description("Show inference usage")
        .option("--start-date <date>", "Start date")
        .option("--end-date <date>", "End date")
        .option("--model <model>", "Model filter")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            printResult(await getClient().getInferenceUsage({
                start_date: opts.startDate,
                end_date: opts.endDate,
                model: opts.model,
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    inference
        .command("jwt")
        .description("Get a JWT for direct inference API access")
        .option("--json", "Output as JSON")
        .action(async () => {
        try {
            printResult(await getClient().getInferenceJwt());
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=inference.js.map