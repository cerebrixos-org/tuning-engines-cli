import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

function printResult(result: any, asJson: boolean): void {
  output.json(result);
}

export function registerTraceCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const traces = program
    .command("traces")
    .description("Inspect runtime traces emitted by LangGraph, Temporal, or custom agents");

  traces
    .command("list")
    .description("List runtime traces")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().listTraces({
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  traces
    .command("show <run-id>")
    .description("Show one runtime trace by run_id")
    .option("--json", "Output as JSON")
    .action(async (runId: string, opts) => {
      try {
        const result = await getClient().getTrace(runId);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
