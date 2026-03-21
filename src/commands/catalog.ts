import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerCatalogCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
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

        output.table(
          ["ID", "Name", "Base Model", "Size", "Price", "Category"],
          models.map((m: any) => [
            m.id,
            m.name || "-",
            m.base_model || "-",
            m.formatted_size || "-",
            m.formatted_price || "-",
            m.category || "-",
          ])
        );
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  catalog
    .command("show <id>")
    .description("Show details of a catalog model")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
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
      } catch (err: any) {
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
    .action(async (id: string, opts) => {
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
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  catalog
    .command("status <model-id> <export-id>")
    .description("Check the status of a catalog model export")
    .option("--json", "Output as JSON")
    .action(async (modelId: string, exportId: string, opts) => {
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
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
