import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerInterventionCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const interventions = program
    .command("interventions")
    .description("Poll and update runtime pause/resume/cancel/replay requests");

  interventions
    .command("list")
    .description("List runtime intervention requests")
    .option("--run-id <id>", "Filter by run_id")
    .option("--status <status>", "Filter by status")
    .option("--kind <kind>", "Filter by kind: pause, resume, cancel, replay")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().listRuntimeInterventions({
          runId: opts.runId,
          status: opts.status,
          kind: opts.kind,
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  interventions
    .command("request <run-id>")
    .description("Create a runtime intervention request as a tenant owner/admin")
    .requiredOption("--kind <kind>", "pause, resume, cancel, or replay")
    .option("--reason <text>", "Reason for the request")
    .option("--target-event-id <id>", "Specific event to replay/retry from")
    .option("--metadata <json>", "Optional JSON metadata")
    .option("--json", "Output as JSON")
    .action(async (runId: string, opts) => {
      try {
        const result = await getClient().createRuntimeIntervention(runId, {
          kind: opts.kind,
          reason: opts.reason,
          target_event_id: opts.targetEventId,
          metadata: parseJsonObject(opts.metadata),
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  interventions
    .command("ack <id>")
    .description("Acknowledge an intervention from a runtime adapter")
    .option("--metadata <json>", "Optional JSON metadata")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => runLifecycle("ack", getClient, id, opts));

  interventions
    .command("complete <id>")
    .description("Mark an intervention completed")
    .option("--metadata <json>", "Optional JSON metadata")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => runLifecycle("complete", getClient, id, opts));

  interventions
    .command("fail <id>")
    .description("Mark an intervention failed")
    .option("--metadata <json>", "Optional JSON metadata")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => runLifecycle("fail", getClient, id, opts));
}

async function runLifecycle(
  action: "ack" | "complete" | "fail",
  getClient: () => TuningEnginesClient,
  id: string,
  opts: any
): Promise<void> {
  try {
    const metadata = parseJsonObject(opts.metadata);
    const client = getClient();
    const result =
      action === "ack"
        ? await client.ackRuntimeIntervention(id, metadata)
        : action === "complete"
          ? await client.completeRuntimeIntervention(id, metadata)
          : await client.failRuntimeIntervention(id, metadata);
    printResult(result, opts.json);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
}

function parseJsonObject(raw?: string): Record<string, any> | undefined {
  if (!raw) return undefined;
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("metadata must be a JSON object");
  }
  return parsed;
}

function printResult(result: any, asJson: boolean): void {
  if (asJson) {
    output.json(result);
    return;
  }
  output.json(result);
}
