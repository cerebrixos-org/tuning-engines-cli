import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";
import { loadJsonObject, parseOptionalNumber } from "./json";

function collection(result: any): any[] {
  return Array.isArray(result?.observed_outcomes) ? result.observed_outcomes : Array.isArray(result?.data) ? result.data : Array.isArray(result?.outcomes) ? result.outcomes : [];
}

function outcomeTracePayload(opts: any): Record<string, any> {
  const metadata = {
    ...loadJsonObject(opts.metadata, "--metadata"),
    outcome_key: opts.key,
    outcome_label: opts.label,
    outcome_score: parseOptionalNumber(opts.score, "--score"),
    goal_key: opts.goalKey,
    goal_status: opts.goalStatus,
    signal_kind: opts.goalKey && !opts.key ? "goal" : undefined,
  };
  Object.keys(metadata).forEach((key) => metadata[key as keyof typeof metadata] === undefined && delete metadata[key as keyof typeof metadata]);

  return {
    run_id: opts.runId,
    request_id: opts.requestId,
    runtime: opts.runtime || "custom",
    telemetry_source: opts.source || "sdk",
    status: "succeeded",
    events: [
      {
        id: `evt_outcome_${Date.now()}`,
        type: "outcome.recorded",
        status: "succeeded",
        metadata,
      },
    ],
  };
}

export function registerOutcomeCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const outcomes = program
    .command("outcomes")
    .description("List, record, and map outcomes/goals as normalized success signals");

  outcomes
    .command("list")
    .description("List observed outcome and goal keys")
    .option("--range <range>", "Time range such as 24h, 7d, 30d")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().listOutcomes({ range: opts.range });
        const rows = collection(result);
        if (opts.json) {
          output.json(result);
          return;
        }
        if (rows.length === 0) {
          console.log("No observed outcomes or goals found.");
          return;
        }
        output.table(
          ["Key", "Registered", "Events", "Success", "Last Seen"],
          rows.map((row: any) => [
            String(row.key || row.outcome_key || "-"),
            row.registered ? "yes" : "no",
            String(row.event_count || row.events || 0),
            row.success_rate === undefined ? "-" : `${row.success_rate}%`,
            row.last_seen ? new Date(row.last_seen).toLocaleString() : "-",
          ])
        );
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  outcomes
    .command("record")
    .description("Record an outcome or goal signal for a run")
    .requiredOption("--run-id <run_id>", "Trace/workflow run ID")
    .requiredOption("--key <outcome_key>", "Outcome key, e.g. support_resolution")
    .requiredOption("--label <outcome_label>", "Outcome label, e.g. resolved or achieved")
    .option("--score <score>", "Numeric outcome score")
    .option("--goal-key <goal_key>", "Original goal key to preserve in metadata")
    .option("--goal-status <goal_status>", "Original goal status to preserve in metadata")
    .option("--request-id <request_id>", "Request ID for correlation")
    .option("--runtime <runtime>", "Runtime label (default custom)")
    .option("--source <source>", "Telemetry source (default sdk)")
    .option("--metadata <json|@file>", "Extra metadata JSON object")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().createTrace(outcomeTracePayload(opts));
        if (opts.json) {
          output.json(result);
        } else {
          console.log(`Recorded success signal ${opts.key}/${opts.label} for ${opts.runId}`);
        }
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  outcomes
    .command("map")
    .description("Create an outcome mapping rule for events that omitted outcome_key/goal_key")
    .requiredOption("--outcome-key <key>", "Target registered outcome key")
    .requiredOption("--criteria <json|@file>", "Mapping criteria JSON object")
    .option("--name <name>", "Rule name")
    .option("--priority <n>", "Rule priority", (v) => Number(v))
    .option("--disabled", "Create disabled")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const payload = {
          outcome_key: opts.outcomeKey,
          name: opts.name,
          priority: opts.priority,
          enabled: opts.disabled ? false : undefined,
          match_criteria: loadJsonObject(opts.criteria, "--criteria"),
        };
        const result = await getClient().createOutcomeMappingRule(payload);
        if (opts.json) {
          output.json(result);
        } else {
          console.log(`Created mapping rule for ${opts.outcomeKey}`);
        }
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
