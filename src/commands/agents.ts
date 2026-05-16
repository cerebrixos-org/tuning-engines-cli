import { Command } from "commander";
import { TuningEnginesClient } from "../client";
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
}
