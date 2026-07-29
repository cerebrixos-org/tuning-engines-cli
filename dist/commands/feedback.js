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
exports.registerFeedbackCommands = registerFeedbackCommands;
const json_1 = require("./json");
const output = __importStar(require("../output"));
function registerFeedbackCommands(program, getClient) {
    const feedback = program.command("feedback").description("List and record inference feedback signals");
    feedback.command("list")
        .option("--limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .action(async (opts) => {
        try {
            output.json(await getClient().listInferenceFeedback({
                limit: Number(opts.limit),
                offset: Number(opts.offset),
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    feedback.command("record")
        .requiredOption("--data <json|@file>", "Feedback payload")
        .action(async (opts) => {
        try {
            output.json(await getClient().createInferenceFeedback((0, json_1.loadJsonObject)(opts.data, "--data")));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=feedback.js.map