import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

function printResult(result: any, asJson: boolean): void {
  if (asJson) {
    output.json(result);
    return;
  }
  output.json(result);
}

export function registerFileCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const files = program
    .command("files")
    .description("Manage OpenAI-compatible files used by agents and inference workflows");

  files
    .command("list")
    .description("List uploaded files visible to the current user")
    .option("--purpose <purpose>", "Filter by purpose")
    .option("-l, --limit <n>", "Max results", "20")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().listFiles({
          purpose: opts.purpose,
          limit: Number(opts.limit),
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  files
    .command("upload <path>")
    .description("Upload a file through the tenant-scoped Files API")
    .option("--purpose <purpose>", "OpenAI-compatible file purpose", "assistants")
    .option("--content-type <type>", "Declared content type", "application/octet-stream")
    .option("--json", "Output as JSON")
    .action(async (filePath: string, opts) => {
      try {
        const result = await getClient().uploadFile(filePath, {
          purpose: opts.purpose,
          contentType: opts.contentType,
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  files
    .command("show <id>")
    .description("Show file metadata")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        printResult(await getClient().getFile(id), opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  files
    .command("download <id>")
    .description("Download raw file content")
    .requiredOption("-o, --output <path>", "Output path")
    .action(async (id: string, opts) => {
      try {
        const body = await getClient().downloadFileContent(id);
        const resolved = path.resolve(opts.output);
        fs.writeFileSync(resolved, body);
        console.log(resolved);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  files
    .command("delete <id>")
    .description("Delete a file")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        printResult(await getClient().deleteFile(id), opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
