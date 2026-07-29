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

  ws.command("repair-preview <id>")
    .description("Preview an evidence move, split, exclude, or restore without applying it")
    .requiredOption("--data <json>", "Repair selection JSON")
    .action(async (id: string, opts) => {
      try {
        output.json(await getClient().previewWorkItemRepair(id, parseJson(opts.data)));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  ws.command("repair <id>")
    .description("Apply a previously previewed Work Session repair")
    .requiredOption("--repair-id <id>", "Repair preview public ID")
    .option("--target-work-item-id <id>", "Target Work Session for a move")
    .option("--split-title <title>", "Title for a split Work Session")
    .option("--reason <text>", "Audit reason")
    .action(async (id: string, opts) => {
      try {
        output.json(await getClient().applyWorkItemRepair(id, {
          repair_id: opts.repairId,
          target_work_item_id: opts.targetWorkItemId,
          split_title: opts.splitTitle,
          reason: opts.reason,
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  ws.command("repair-undo <id>")
    .description("Undo an applied Work Session repair")
    .requiredOption("--repair-id <id>", "Applied repair public ID")
    .option("--reason <text>", "Audit reason")
    .action(async (id: string, opts) => {
      try {
        output.json(await getClient().undoWorkItemRepair(id, {
          repair_id: opts.repairId,
          reason: opts.reason,
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  ws.command("bulk-preview")
    .description("Preview a bulk Work Session review operation")
    .requiredOption("--data <json>", "Bulk operation JSON")
    .action((opts) => getClient().previewWorkItemBulkOperation(parseJson(opts.data))
      .then(output.json)
      .catch(fail));

  ws.command("bulk-apply <id>")
    .description("Apply a previously previewed bulk operation")
    .action((id: string) => getClient().applyWorkItemBulkOperation(id)
      .then(output.json)
      .catch(fail));
}

function parseJson(raw: string): Record<string, any> {
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("data must be a JSON object");
  }
  return value;
}

function fail(error: any): void {
  console.error(error.message);
  process.exit(1);
}
