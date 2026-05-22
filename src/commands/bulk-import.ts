import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

const TARGET_TYPES = ["McpServer", "TenantAgent", "TenantSkill"];

function printResult(result: any, asJson: boolean): void {
  if (asJson) {
    output.json(result);
    return;
  }
  output.json(result);
}

function readRows(filePath: string): Record<string, any>[] {
  const resolved = path.resolve(filePath);
  const parsed = YAML.parse(fs.readFileSync(resolved, "utf8"));
  const rows = Array.isArray(parsed) ? parsed : parsed?.rows;
  if (!Array.isArray(rows)) {
    throw new Error("Bulk import file must be an array or an object with a rows array");
  }
  return rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Every bulk import row must be an object");
    }
    return row;
  });
}

export function registerBulkImportCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const bulk = program
    .command("bulk-import")
    .description("Bulk import MCP servers, tenant agents, and tenant skills");

  bulk
    .command("list")
    .description("List recent bulk imports")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().listBulkImports({
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  bulk
    .command("show <id>")
    .description("Show a bulk import result")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        printResult(await getClient().getBulkImport(id), opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  bulk
    .command("run")
    .description("Validate or apply a YAML/JSON bulk import file")
    .requiredOption("--target <type>", `Target type: ${TARGET_TYPES.join(", ")}`)
    .requiredOption("--file <path>", "YAML or JSON file containing rows")
    .option("--dry-run", "Validate without creating records")
    .option("--apply", "Create records")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        if (!TARGET_TYPES.includes(opts.target)) {
          throw new Error(`--target must be one of: ${TARGET_TYPES.join(", ")}`);
        }
        if (opts.dryRun && opts.apply) {
          throw new Error("Choose only one of --dry-run or --apply");
        }
        const result = await getClient().createBulkImport({
          target_type: opts.target,
          rows: readRows(opts.file),
          dry_run: !opts.apply,
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
