import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerUserModelCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const models = program
    .command("user-models")
    .description("Manage trained and imported models");

  models.command("list")
    .description("List your models")
    .option("--limit <n>", "Max results", "20")
    .option("--offset <n>", "Offset for pagination", "0")
    .action(async (opts) => {
      try {
        output.json(await getClient().listUserModels({
          limit: parseInt(opts.limit),
          offset: parseInt(opts.offset),
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  models.command("show <id>")
    .description("Show model details")
    .action(async (id: string) => {
      try {
        output.json(await getClient().getUserModel(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  models.command("status <id>")
    .description("Check model readiness status")
    .action(async (id: string) => {
      try {
        output.json(await getClient().getUserModelStatus(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  models.command("import")
    .description("Import a model from cloud storage")
    .requiredOption("--name <name>", "Model name")
    .requiredOption("--path <path>", "Storage path or URL")
    .option("--source-type <type>", "Source type (manual, trained)", "manual")
    .action(async (opts) => {
      try {
        output.json(await getClient().importUserModel({
          name: opts.name,
          modal_path: opts.path,
          source_type: opts.sourceType,
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  models.command("export <id>")
    .description("Export a model to S3")
    .option("--bucket <bucket>", "S3 bucket name")
    .option("--prefix <prefix>", "S3 key prefix")
    .action(async (id: string, opts) => {
      try {
        output.json(await getClient().exportUserModel(id, {
          s3_bucket: opts.bucket,
          s3_prefix: opts.prefix,
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  models.command("delete <id>")
    .description("Delete a model from cloud storage")
    .action(async (id: string) => {
      try {
        output.json(await getClient().deleteUserModel(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
