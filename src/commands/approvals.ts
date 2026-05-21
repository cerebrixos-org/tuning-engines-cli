import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

function printResult(result: any, asJson: boolean): void {
  output.json(result);
}

export function registerApprovalCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const approvals = program
    .command("approvals")
    .description("List and review policy approval requests");

  approvals
    .command("list")
    .description("List approval requests for the current tenant")
    .option("--status <status>", "pending, approved, denied, or expired")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().listApprovals({
          status: opts.status,
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  approvals
    .command("show <id>")
    .description("Show an approval request")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().getApproval(id);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  approvals
    .command("approve <id>")
    .description("Approve a pending policy approval request")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().approveApproval(id);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  approvals
    .command("deny <id>")
    .description("Deny a pending policy approval request")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().denyApproval(id);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
