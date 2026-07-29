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
exports.registerAgentCommands = registerAgentCommands;
const inference_request_1 = require("../inference_request");
const output = __importStar(require("../output"));
function printResult(result) {
    output.json(result);
}
function registerAgentCommands(program, getClient) {
    const agents = program
        .command("agents")
        .description("Inspect available platform agents");
    agents
        .command("list")
        .description("List available agents")
        .option("--json", "Output as JSON")
        .action(async () => {
        try {
            printResult(await getClient().listAgents());
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    agents
        .command("show <id>")
        .description("Show agent details")
        .option("--json", "Output as JSON")
        .action(async (id) => {
        try {
            printResult(await getClient().getAgent(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    agents
        .command("message <name>")
        .description("Send a governed message to a registered A2A agent")
        .requiredOption("--data <json>", "Agent message request JSON")
        .option("--key <key>", "Inference key; defaults to TE_INFERENCE_KEY or a short-lived JWT")
        .option("--base-url <url>", "Inference base URL; defaults to TE_INFERENCE_URL")
        .option("--json", "Output as JSON")
        .action(async (name, opts) => {
        try {
            const bearer = await (0, inference_request_1.resolveInferenceBearer)(getClient(), opts.key);
            printResult(await (0, inference_request_1.callInference)(`/agents/${encodeURIComponent(name)}/message`, (0, inference_request_1.parseJsonObject)(opts.data), bearer, { baseUrl: opts.baseUrl }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=agents.js.map