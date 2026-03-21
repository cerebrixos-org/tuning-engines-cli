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
exports.registerModelCommands = registerModelCommands;
const output = __importStar(require("../output"));
function registerModelCommands(program, getClient) {
    const models = program.command("models").description("Manage your trained models");
    models
        .command("list")
        .description("List your trained and imported models")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const client = getClient();
            const result = await client.listUserModels();
            const models = result.data || [];
            if (opts.json) {
                output.json(models);
                return;
            }
            if (models.length === 0) {
                console.log("No models found.");
                return;
            }
            output.table(["ID", "Name", "Status", "Source", "Base Model", "Size", "Created"], models.map((m) => [
                m.id,
                m.name || "-",
                m.status,
                m.source_type || "-",
                m.base_model || "-",
                m.size_bytes ? formatBytes(m.size_bytes) : "-",
                new Date(m.created_at).toLocaleDateString(),
            ]));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    models
        .command("show <id>")
        .description("Show model details")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const client = getClient();
            const model = await client.getUserModel(id);
            if (opts.json) {
                output.json(model);
                return;
            }
            output.keyValue([
                ["ID", model.id],
                ["Name", model.name],
                ["Status", model.status],
                ["Source", model.source_type],
                ["Base Model", model.base_model],
                ["Size", model.size_bytes ? formatBytes(model.size_bytes) : "-"],
                ["Volume Path", model.modal_volume_path || "-"],
                ["Training Job", model.training_job_id || "-"],
                ["Created", model.created_at],
                ["Updated", model.updated_at],
            ]);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    models
        .command("delete <id>")
        .description("Delete a model")
        .action(async (id) => {
        try {
            const client = getClient();
            const result = await client.deleteUserModel(id);
            console.log(result.message || "Model deleted.");
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    models
        .command("status <id>")
        .description("Check import/export progress")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const client = getClient();
            const status = await client.getUserModelStatus(id);
            if (opts.json) {
                output.json(status);
                return;
            }
            output.keyValue([
                ["Status", status.status],
                ["Display", status.display_status || "-"],
                ["Size", status.size || "-"],
                ["Error", status.error || "-"],
            ]);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    models
        .command("import")
        .description("Import a model from S3")
        .requiredOption("--name <name>", "Model name")
        .requiredOption("--s3-url <url>", "S3 URL (s3://bucket/path)")
        .requiredOption("--base-model <model>", "Base model HuggingFace ID")
        .requiredOption("--s3-key <key>", "AWS access key ID")
        .requiredOption("--s3-secret <secret>", "AWS secret access key")
        .requiredOption("--s3-region <region>", "AWS region")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const client = getClient();
            const model = await client.importModel({
                name: opts.name,
                source_s3_url: opts.s3Url,
                base_model: opts.baseModel,
                s3_access_key_id: opts.s3Key,
                s3_secret_access_key: opts.s3Secret,
                s3_region: opts.s3Region,
            });
            if (opts.json) {
                output.json(model);
                return;
            }
            console.log(`Import started: ${model.id}`);
            console.log(`Name: ${model.name}`);
            console.log("Use 'te models status <id>' to check progress.");
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    models
        .command("export <id>")
        .description("Export a model to S3")
        .requiredOption("--s3-bucket <bucket>", "S3 bucket name")
        .option("--s3-prefix <prefix>", "S3 key prefix")
        .requiredOption("--s3-key <key>", "AWS access key ID")
        .requiredOption("--s3-secret <secret>", "AWS secret access key")
        .requiredOption("--s3-region <region>", "AWS region")
        .option("--delete-after", "Delete model from cloud after export")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const client = getClient();
            const model = await client.exportModel(id, {
                s3_bucket: opts.s3Bucket,
                s3_prefix: opts.s3Prefix,
                s3_access_key_id: opts.s3Key,
                s3_secret_access_key: opts.s3Secret,
                s3_region: opts.s3Region,
                delete_after: opts.deleteAfter || false,
            });
            if (opts.json) {
                output.json(model);
                return;
            }
            console.log(`Export started for model ${model.id}`);
            console.log("Use 'te models status <id>' to check progress.");
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    // Also register "base-models" subcommand for listing supported base models
    models
        .command("base")
        .description("List supported base models for fine-tuning")
        .option("--agent <agent>", "Filter by agent (e.g. code_repo, sera_code_repo)")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const client = getClient();
            const result = await client.listModels({ agent: opts.agent });
            const models = result.models || [];
            if (opts.json) {
                output.json(models);
                return;
            }
            output.table(["ID", "Name", "Size", "GPU hr/epoch"], models.map((m) => [
                m.id,
                m.name,
                m.size || "-",
                String(m.gpu_hours_per_epoch || "-"),
            ]));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
function formatBytes(bytes) {
    if (bytes === 0)
        return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
//# sourceMappingURL=models.js.map