import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

function printResult(result: any, asJson: boolean): void {
  output.json(result);
}

export function registerPolicyDecisionCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const decisions = program
    .command("policy-decisions")
    .alias("policy")
    .description("Inspect AGT YAML policy decisions captured by the inference gateway");

  decisions
    .command("list")
    .description("List policy decisions for the current tenant")
    .option("--decision-action <action>", "allow, deny, audit, or needs_approval")
    .option("--policy-action <action>", "Alias for --decision-action")
    .option("--evaluation-mode <mode>", "enforce or shadow")
    .option("--run-id <runId>", "Filter by trace/run ID")
    .option("--request-id <requestId>", "Filter by request ID")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().listPolicyDecisions({
          decision_action: opts.decisionAction,
          policy_action: opts.policyAction,
          evaluation_mode: opts.evaluationMode,
          run_id: opts.runId,
          request_id: opts.requestId,
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  decisions
    .command("show <id>")
    .description("Show one policy decision with redacted context and metadata")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().getPolicyDecision(id);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
