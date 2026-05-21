import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerStateCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const state = program
    .command("state")
    .description("Manage external runtime state and memory references");

  state
    .command("list")
    .description("List runtime state references")
    .option("--run-id <id>", "Filter by run_id")
    .option("--type <type>", "Reference type")
    .option("--provider <provider>", "Provider")
    .option("--resource-type <type>", "Resource type")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().listRuntimeStateReferences({
          runId: opts.runId,
          referenceType: opts.type,
          provider: opts.provider,
          resourceType: opts.resourceType,
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  state
    .command("upsert")
    .description("Create or update a safe pointer to external runtime state")
    .requiredOption("--type <type>", "langgraph_checkpoint, temporal_workflow, vector_namespace, memory_record, external_context")
    .requiredOption("--external-id <id>", "External id or namespace")
    .option("--run-id <id>", "Associated run_id")
    .option("--provider <provider>", "Provider")
    .option("--uri <uri>", "Safe URI or key reference")
    .option("--runtime <runtime>", "langgraph, temporal, or custom")
    .option("--resource-type <type>", "Resource type")
    .option("--resource-id <id>", "Resource id")
    .option("--resource-name <name>", "Resource name")
    .option("--status <status>", "active, archived, stale, failed")
    .option("--metadata <json>", "Optional JSON metadata")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().upsertRuntimeStateReference({
          reference_type: opts.type,
          external_id: opts.externalId,
          run_id: opts.runId,
          provider: opts.provider,
          uri: opts.uri,
          runtime: opts.runtime,
          resource_type: opts.resourceType,
          resource_id: opts.resourceId,
          resource_name: opts.resourceName,
          status: opts.status,
          metadata: parseJsonObject(opts.metadata) || {},
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
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
