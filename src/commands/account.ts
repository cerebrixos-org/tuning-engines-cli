import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerAccountCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  program
    .command("account")
    .description("Show account information")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const client = getClient();
        const account = await client.getAccount();

        if (opts.json) {
          output.json(account);
          return;
        }

        output.keyValue([
          ["Name", account.name],
          ["Email", account.email],
          ["Auth Provider", account.provider || "email"],
        ]);

        if (account.provisioning) {
          const p = account.provisioning;
          console.log();
          console.log("Provisioning:");
          output.keyValue([
            ["  Status", p.status || "-"],
            ["  Stripe", p.stripe ? "OK" : "Not configured"],
            ["  Zuplo", p.zuplo ? "OK" : "Not configured"],
          ]);
        }
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
