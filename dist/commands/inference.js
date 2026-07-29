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
const inference_request_1 = require("../inference_request");
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
        .description("Show inference usage logs or analytics")
        .option("--view <view>", "Analytics view: overview, models, users, errors, activity, or logs")
        .option("--range <range>", "Usage range: 24h, 7d, 30d, or custom", "7d")
        .option("--start-date <date>", "Start date")
        .option("--end-date <date>", "End date")
        .option("--model <model>", "Model filter")
        .option("--user-id <id>", "User filter for tenant admins")
        .option("-l, --limit <n>", "Max rows/items", "50")
        .option("--page <n>", "Page for logs view", "1")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const params = {
                range: opts.range,
                start_date: opts.startDate,
                end_date: opts.endDate,
                model: opts.model,
                user_id: opts.userId,
                limit: Number(opts.limit),
                page: Number(opts.page),
            };
            printResult(opts.view
                ? await getClient().getInferenceUsageAnalytics({ ...params, view: opts.view })
                : await getClient().getInferenceUsage(params));
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
    inference
        .command("token")
        .description("Exchange an inference key (sk-te-...) for a short-lived inference JWT")
        .option("--json", "Output as JSON")
        .action(async () => {
        try {
            printResult(await getClient().getInferenceToken());
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    registerInferenceCall(inference, "chat", "/chat/completions", "Run an OpenAI-compatible chat completion", getClient);
    registerInferenceCall(inference, "responses", "/responses", "Run an OpenAI Responses API request", getClient);
    registerInferenceCall(inference, "embeddings", "/embeddings", "Create embeddings", getClient);
    registerInferenceCall(inference, "messages", "/messages", "Run an Anthropic-compatible Messages request", getClient);
}
function registerInferenceCall(inference, command, endpoint, description, getClient) {
    inference
        .command(command)
        .description(description)
        .requiredOption("--data <json>", "Request payload JSON")
        .option("--key <key>", "Inference key; defaults to TE_INFERENCE_KEY or a short-lived JWT")
        .option("--base-url <url>", "Inference base URL; defaults to TE_INFERENCE_URL")
        .option("--stream", "Stream the raw response to stdout")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const client = getClient();
            const bearer = await (0, inference_request_1.resolveInferenceBearer)(client, opts.key);
            const result = await (0, inference_request_1.callInference)(endpoint, (0, inference_request_1.parseJsonObject)(opts.data), bearer, {
                baseUrl: opts.baseUrl,
                stream: Boolean(opts.stream),
            });
            if (result !== undefined)
                printResult(result);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=inference.js.map