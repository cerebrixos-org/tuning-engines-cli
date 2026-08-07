import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerContextCommands(program: Command, getClient: () => TuningEnginesClient): void {
  const context = program
    .command("context")
    .description("Resolve governed, versioned context for an agent turn");

  context
    .command("resolve <query>")
    .description("Resolve authorized context; observe mode returns lineage without injecting content")
    .option("--asset <id...>", "Restrict resolution to context asset IDs")
    .option("--goal-key <key>", "Stable goal key")
    .option("--entity <value...>", "Structured entity values")
    .option("--action <action>", "Requested action")
    .option("--sensitivity <level>", "Sensitivity classification")
    .option("--request-id <id>", "Request correlation ID")
    .option("--run-id <id>", "Run correlation ID")
    .option("--json", "Output as JSON")
    .action(async (query: string, opts) => {
      try {
        const result = await getClient().resolveContext({
          query,
          context_asset_ids: opts.asset,
          goal_key: opts.goalKey,
          entities: opts.entity,
          action: opts.action,
          sensitivity: opts.sensitivity,
          request_id: opts.requestId,
          run_id: opts.runId,
        });
        output.json(result);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
