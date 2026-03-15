import { Command } from "commander";
import { exec } from "child_process";
import { TuningEnginesClient } from "../client";
import { getApiUrl } from "../config";
import * as output from "../output";

function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string;

  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, (err) => {
    if (err) {
      console.log(`Could not open browser automatically. Please visit:\n  ${url}`);
    }
  });
}

export function registerBillingCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const billing = program.command("billing").description("Billing and credits");

  billing
    .command("show")
    .description("Show account balance and recent transactions")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const client = getClient();
        const billing = await client.getBilling();

        if (opts.json) {
          output.json(billing);
          return;
        }

        console.log(`Balance: ${output.formatCents(billing.balance_cents)}`);
        console.log();

        if (billing.auto_topup) {
          const at = billing.auto_topup;
          console.log(`Auto Top-Up: ${at.enabled ? "Enabled" : "Disabled"}`);
          if (at.enabled) {
            console.log(`  Threshold: ${output.formatCents(at.threshold_cents)}`);
            console.log(`  Amount: ${output.formatCents(at.amount_cents)}`);
          }
          console.log();
        }

        const txns = billing.transactions || [];
        if (txns.length > 0) {
          console.log("Recent Transactions:");
          output.table(
            ["Date", "Type", "Amount", "Balance After", "Description"],
            txns.slice(0, 20).map((t: any) => [
              new Date(t.created_at).toLocaleDateString(),
              t.transaction_type || "-",
              output.formatCents(t.amount_cents),
              output.formatCents(t.balance_after_cents),
              t.description || "-",
            ])
          );
        } else {
          console.log("No transactions yet.");
        }
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  billing
    .command("add-credits")
    .description("Open the billing page in your browser to add credits")
    .action(() => {
      const apiUrl = getApiUrl();
      const billingUrl = `${apiUrl}/billing`;
      console.log("Opening billing page to add credits...");
      openBrowser(billingUrl);
      console.log(`\nIf the browser didn't open, visit:\n  ${billingUrl}`);
    });
}
