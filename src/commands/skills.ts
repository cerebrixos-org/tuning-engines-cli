import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import { callInference, parseJsonObject, resolveInferenceBearer } from "../inference_request";
import * as output from "../output";

export function registerSkillCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const skills = program.command("skills").description("Discover and invoke governed skills");

  skills.command("list")
    .description("List skills available to the current inference identity")
    .option("--key <key>", "Inference key; defaults to TE_INFERENCE_KEY or a short-lived JWT")
    .option("--base-url <url>", "Inference base URL; defaults to TE_INFERENCE_URL")
    .action(async (opts) => {
      try {
        const bearer = await resolveInferenceBearer(getClient(), opts.key);
        output.json(await callInference("/skills", undefined, bearer, {
          baseUrl: opts.baseUrl,
          method: "GET",
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  for (const action of ["prepare", "invoke"] as const) {
    skills.command(`${action} <name>`)
      .description(`${action === "prepare" ? "Prepare" : "Invoke"} a governed skill`)
      .requiredOption("--data <json>", "Skill request JSON")
      .option("--key <key>", "Inference key; defaults to TE_INFERENCE_KEY or a short-lived JWT")
      .option("--base-url <url>", "Inference base URL; defaults to TE_INFERENCE_URL")
      .action(async (name: string, opts) => {
        try {
          const bearer = await resolveInferenceBearer(getClient(), opts.key);
          output.json(await callInference(
            `/skills/${encodeURIComponent(name)}/${action}`,
            parseJsonObject(opts.data),
            bearer,
            { baseUrl: opts.baseUrl }
          ));
        } catch (err: any) {
          console.error(err.message);
          process.exit(1);
        }
      });
  }
}
