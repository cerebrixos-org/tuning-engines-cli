import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

function parseJsonObject(raw?: string): Record<string, any> {
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--data must be a JSON object");
  }
  return parsed;
}

function printResult(result: any): void {
  output.json(result);
}

export function registerDatasetCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
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
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  datasets
    .command("show <id>")
    .description("Show dataset details")
    .option("--json", "Output as JSON")
    .action(async (id: string) => {
      try {
        printResult(await getClient().getDataset(id));
      } catch (err: any) {
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
        printResult(await getClient().createDataset(parseJsonObject(opts.data) as any));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  datasets
    .command("update <id>")
    .description("Update dataset metadata from JSON")
    .requiredOption("--data <json>", "JSON object with changed attributes")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        printResult(await getClient().updateDataset(id, parseJsonObject(opts.data)));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  datasets
    .command("delete <id>")
    .description("Delete a dataset")
    .option("--json", "Output as JSON")
    .action(async (id: string) => {
      try {
        printResult(await getClient().deleteDataset(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  datasets
    .command("status <id>")
    .description("Check dataset processing status")
    .option("--json", "Output as JSON")
    .action(async (id: string) => {
      try {
        printResult(await getClient().getDatasetStatus(id));
      } catch (err: any) {
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
        printResult(await getClient().validateDatasetS3(parseJsonObject(opts.data) as any));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
