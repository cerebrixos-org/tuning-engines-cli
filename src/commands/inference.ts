import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

function printResult(result: any): void {
  output.json(result);
}

export function registerInferenceCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const inference = program
    .command("inference")
    .description("Inspect inference models, usage, and direct API access");

  inference
    .command("models")
    .description("List available inference models")
    .option("--json", "Output as JSON")
    .action(async () => {
      try {
        printResult(await getClient().listInferenceModels());
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  inference
    .command("usage")
    .description("Show inference usage logs or analytics")
    .option("--view <view>", "Analytics view: overview, models, users, errors, activity, or logs")
    .option("--range <range>", "Usage range: 24h, 7d, 30d, or custom", "7d")
    .option("--start-date <date>", "Start date")
    .option("--end-date <date>", "End date")
    .option("--model <model>", "Model filter")
    .option("--user-id <id>", "User filter for tenant admins")
    .option("-l, --limit <n>", "Max rows/items", "50")
    .option("--page <n>", "Page for logs view", "1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const params = {
          range: opts.range,
          start_date: opts.startDate,
          end_date: opts.endDate,
          model: opts.model,
          user_id: opts.userId,
          limit: Number(opts.limit),
          page: Number(opts.page),
        };
        printResult(opts.view
          ? await getClient().getInferenceUsageAnalytics({ ...params, view: opts.view })
          : await getClient().getInferenceUsage(params));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  inference
    .command("jwt")
    .description("Get a JWT for direct inference API access")
    .option("--json", "Output as JSON")
    .action(async () => {
      try {
        printResult(await getClient().getInferenceJwt());
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  inference
    .command("token")
    .description("Exchange an inference key (sk-te-...) for a short-lived inference JWT")
    .option("--json", "Output as JSON")
    .action(async () => {
      try {
        printResult(await getClient().getInferenceToken());
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
