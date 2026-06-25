import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerInitiativeCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const init = program
    .command("initiatives")
    .description("Manage strategic initiatives that group work sessions");

  init.command("list")
    .description("List initiatives")
    .option("--limit <n>", "Max results", "20")
    .option("--offset <n>", "Offset for pagination", "0")
    .action(async (opts) => {
      try {
        output.json(await getClient().listInitiatives({
          limit: parseInt(opts.limit),
          offset: parseInt(opts.offset),
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  init.command("show <id>")
    .description("Show initiative details")
    .action(async (id: string) => {
      try {
        output.json(await getClient().getInitiative(id));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  init.command("create")
    .description("Create an initiative")
    .requiredOption("--title <title>", "Initiative title")
    .option("--description <desc>", "Initiative description")
    .action(async (opts) => {
      try {
        output.json(await getClient().createInitiative({
          title: opts.title,
          description: opts.description,
        }));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  init.command("update <id>")
    .description("Update an initiative")
    .option("--title <title>", "New title")
    .option("--description <desc>", "New description")
    .option("--status <status>", "Status (active, completed, archived)")
    .action(async (id: string, opts) => {
      try {
        const params: Record<string, any> = {};
        if (opts.title) params.title = opts.title;
        if (opts.description) params.description = opts.description;
        if (opts.status) params.status = opts.status;
        output.json(await getClient().updateInitiative(id, params));
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
