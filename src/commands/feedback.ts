import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import { loadJsonObject } from "./json";
import * as output from "../output";

export function registerFeedbackCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const feedback = program.command("feedback").description("List and record inference feedback signals");

  feedback.command("list")
    .option("--limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .action(async (opts) => {
      try {
        output.json(await getClient().listInferenceFeedback({
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  feedback.command("record")
    .requiredOption("--data <json|@file>", "Feedback payload")
    .action(async (opts) => {
      try {
        output.json(await getClient().createInferenceFeedback(loadJsonObject(opts.data, "--data")));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
