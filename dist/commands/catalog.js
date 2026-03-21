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
exports.registerCatalogCommands = registerCatalogCommands;
const output = __importStar(require("../output"));
function registerCatalogCommands(program, getClient) {
    const catalog = program.command("catalog").description("Browse and export pre-built models and datasets from the Marketplace");
    catalog
        .command("list")
        .description("List available pre-built models")
        .option("--category <category>", "Filter by category (e.g. code, bug-fix)")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const client = getClient();
            const result = await client.listCatalogModels({ category: opts.category });
            const models = result.data || [];
            if (opts.json) {
                output.json(models);
                return;
            }
            if (models.length === 0) {
                console.log("No catalog models available.");
                return;
            }
            output.table(["ID", "Name", "Base Model", "Size", "Price", "Category"], models.map((m) => [
                m.id,
                m.name || "-",
                m.base_model || "-",
                m.formatted_size || "-",
                m.formatted_price || "-",
                m.category || "-",
            ]));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    catalog
        .command("show <id>")
        .description("Show details of a catalog model")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const client = getClient();
            const model = await client.getCatalogModel(id);
            if (opts.json) {
                output.json(model);
                return;
            }
            output.keyValue([
                ["ID", model.id],
                ["Name", model.name],
                ["Tagline", model.tagline || "-"],
                ["Description", model.description || "-"],
                ["Base Model", model.base_model || "-"],
                ["Agent", model.agent_key || "-"],
                ["Size", model.formatted_size || "-"],
                ["Export Price", model.formatted_price || "-"],
                ["Category", model.category || "-"],
                ["Featured", model.featured ? "Yes" : "No"],
                ["Total Exports", String(model.total_exports || 0)],
            ]);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    catalog
        .command("export <id>")
        .description("Export a catalog model to your S3 bucket")
        .requiredOption("--s3-bucket <bucket>", "S3 bucket name")
        .option("--s3-prefix <prefix>", "S3 key prefix")
        .requiredOption("--s3-key <key>", "AWS access key ID")
        .requiredOption("--s3-secret <secret>", "AWS secret access key")
        .requiredOption("--s3-region <region>", "AWS region")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const client = getClient();
            const result = await client.exportCatalogModel(id, {
                s3_bucket: opts.s3Bucket,
                s3_prefix: opts.s3Prefix,
                s3_access_key_id: opts.s3Key,
                s3_secret_access_key: opts.s3Secret,
                s3_region: opts.s3Region,
            });
            if (opts.json) {
                output.json(result);
                return;
            }
            console.log(`Export started.`);
            console.log(`Export ID: ${result.export_id}`);
            console.log(`Charge: ${result.charge || "Free"}`);
            console.log(`Use 'te catalog status ${id} ${result.export_id}' to check progress.`);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    catalog
        .command("status <model-id> <export-id>")
        .description("Check the status of a catalog model export")
        .option("--json", "Output as JSON")
        .action(async (modelId, exportId, opts) => {
        try {
            const client = getClient();
            const status = await client.getCatalogExportStatus(modelId, exportId);
            if (opts.json) {
                output.json(status);
                return;
            }
            output.keyValue([
                ["Export ID", status.export_id],
                ["Model", status.model_name || "-"],
                ["Status", status.display_status || status.status],
                ["Charge", status.charge_cents ? `$${(status.charge_cents / 100).toFixed(2)}` : "Free"],
                ["Charged", status.charged ? "Yes" : "No"],
                ["Error", status.error || "-"],
                ["Created", status.created_at || "-"],
            ]);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=catalog.js.map