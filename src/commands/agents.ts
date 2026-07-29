import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import { callInference, parseJsonObject, resolveInferenceBearer } from "../inference_request";
import * as output from "../output";

function printResult(result: any): void {
  output.json(result);
}

export function registerAgentCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const agents = program
    .command("agents")
    .description("Inspect available platform agents");

  agents
    .command("list")
    .description("List available agents")
    .option("--json", "Output as JSON")
    .action(async () => {
      try {
        printResult(await getClient().listAgents());
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  agents
    .command("show <id>")
    .description("Show agent details")
    .option("--json", "Output as JSON")
    .action(async (id: string) => {
      try {
        printResult(await getClient().getAgent(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  agents
    .command("message <name>")
    .description("Send a governed message to a registered A2A agent")
    .requiredOption("--data <json>", "Agent message request JSON")
    .option("--key <key>", "Inference key; defaults to TE_INFERENCE_KEY or a short-lived JWT")
    .option("--base-url <url>", "Inference base URL; defaults to TE_INFERENCE_URL")
    .option("--json", "Output as JSON")
    .action(async (name: string, opts) => {
      try {
        const bearer = await resolveInferenceBearer(getClient(), opts.key);
        printResult(await callInference(
          `/agents/${encodeURIComponent(name)}/message`,
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
