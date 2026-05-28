import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";
import { loadJsonObject } from "./json";

export function registerDoctorCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const doctor = program
    .command("doctor")
    .description("Debug inference access with the same role/policy simulator used by the app");

  doctor
    .command("simulate")
    .description("Run an Inference Doctor simulation from JSON")
    .requiredOption("--data <json|@file>", "Simulation payload JSON object")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const payload = loadJsonObject(opts.data, "--data");
        const result = await getClient().doctorSimulate(payload);
        output.json(opts.json ? result : result.data || result);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
