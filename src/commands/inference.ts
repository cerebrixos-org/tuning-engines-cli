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
    .description("Show inference usage")
    .option("--start-date <date>", "Start date")
    .option("--end-date <date>", "End date")
    .option("--model <model>", "Model filter")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        printResult(await getClient().getInferenceUsage({
          start_date: opts.startDate,
          end_date: opts.endDate,
          model: opts.model,
        }));
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
