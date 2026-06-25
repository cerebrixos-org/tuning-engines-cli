import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerWorkSessionCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const ws = program
    .command("work-sessions")
    .description("Manage work sessions (traced agent runs grouped by outcome)");

  ws.command("list")
    .description("List work sessions")
    .option("--limit <n>", "Max results", "20")
    .option("--offset <n>", "Offset for pagination", "0")
    .option("--status <status>", "Filter by status (active, completed, archived)")
    .action(async (opts) => {
      try {
        output.json(await getClient().listWorkItems({
          limit: parseInt(opts.limit),
          offset: parseInt(opts.offset),
          status: opts.status,
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  ws.command("show <id>")
    .description("Show work session details")
    .action(async (id: string) => {
      try {
        output.json(await getClient().getWorkItem(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  ws.command("complete <id>")
    .description("Mark a work session as completed")
    .action(async (id: string) => {
      try {
        output.json(await getClient().completeWorkItem(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  ws.command("confirm-outcome <id>")
    .description("Confirm the outcome of a work session")
    .requiredOption("--outcome-id <id>", "Inference outcome ID")
    .option("--result-status <status>", "Result status (succeeded, failed, partial)")
    .option("--label <label>", "Outcome label")
    .action(async (id: string, opts) => {
      try {
        output.json(await getClient().confirmWorkItemOutcome(id, {
          inference_outcome_id: parseInt(opts.outcomeId),
          result_status: opts.resultStatus,
          label: opts.label,
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
