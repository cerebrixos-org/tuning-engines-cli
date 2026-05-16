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

export function registerEvaluationCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const evals = program
    .command("evals")
    .description("Manage model evaluations");

  evals
    .command("list")
    .description("List evaluations")
    .option("--status <status>", "Filter by status")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        printResult(await getClient().listEvaluations({
          status: opts.status,
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  evals
    .command("show <id>")
    .description("Show evaluation details")
    .option("--json", "Output as JSON")
    .action(async (id: string) => {
      try {
        printResult(await getClient().getEvaluation(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  evals
    .command("create")
    .description("Create an evaluation from JSON")
    .requiredOption("--data <json>", "JSON object with evaluation attributes")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        printResult(await getClient().createEvaluation(parseJsonObject(opts.data) as any));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  evals
    .command("cancel <id>")
    .description("Cancel a running evaluation")
    .option("--json", "Output as JSON")
    .action(async (id: string) => {
      try {
        printResult(await getClient().cancelEvaluation(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  evals
    .command("retry <id>")
    .description("Retry a failed evaluation")
    .option("--json", "Output as JSON")
    .action(async (id: string) => {
      try {
        printResult(await getClient().retryEvaluation(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  evals
    .command("status <id>")
    .description("Check evaluation status")
    .option("--json", "Output as JSON")
    .action(async (id: string) => {
      try {
        printResult(await getClient().getEvaluationStatus(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  evals
    .command("evaluators")
    .description("List available evaluators")
    .option("--json", "Output as JSON")
    .action(async () => {
      try {
        printResult(await getClient().listEvaluators());
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  evals
    .command("estimate")
    .description("Estimate evaluation cost from JSON")
    .requiredOption("--data <json>", "JSON object with evaluation attributes")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        printResult(await getClient().estimateEvaluation(parseJsonObject(opts.data) as any));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
