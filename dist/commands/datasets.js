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
exports.registerDatasetCommands = registerDatasetCommands;
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
function registerDatasetCommands(program, getClient) {
    const datasets = program
        .command("datasets")
        .description("Manage datasets for training and evaluation");
    datasets
        .command("list")
        .description("List datasets")
        .option("-l, --limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            printResult(await getClient().listDatasets({
                limit: Number(opts.limit),
                offset: Number(opts.offset),
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    datasets
        .command("show <id>")
        .description("Show dataset details")
        .option("--json", "Output as JSON")
        .action(async (id) => {
        try {
            printResult(await getClient().getDataset(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    datasets
        .command("create")
        .description("Create a dataset from JSON")
        .requiredOption("--data <json>", "JSON object with dataset attributes")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            printResult(await getClient().createDataset(parseJsonObject(opts.data)));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    datasets
        .command("update <id>")
        .description("Update dataset metadata from JSON")
        .requiredOption("--data <json>", "JSON object with changed attributes")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            printResult(await getClient().updateDataset(id, parseJsonObject(opts.data)));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    datasets
        .command("delete <id>")
        .description("Delete a dataset")
        .option("--json", "Output as JSON")
        .action(async (id) => {
        try {
            printResult(await getClient().deleteDataset(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    datasets
        .command("status <id>")
        .description("Check dataset processing status")
        .option("--json", "Output as JSON")
        .action(async (id) => {
        try {
            printResult(await getClient().getDatasetStatus(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    datasets
        .command("validate-s3")
        .description("Validate dataset S3 credentials")
        .requiredOption("--data <json>", "JSON object with s3_url, s3_access_key_id, s3_secret_access_key, s3_region")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            printResult(await getClient().validateDatasetS3(parseJsonObject(opts.data)));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=datasets.js.map