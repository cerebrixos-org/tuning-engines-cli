import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerAssetCommands(program: Command, getClient: () => TuningEnginesClient): void {
  const assets = program.command("assets").description("Inspect governed AI system assets and reviewed topology");

  assets.command("list")
    .option("--type <type>", "Asset type")
    .option("--source <source>", "Source system")
    .option("--state <state>", "Lifecycle state")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .action(async (opts) => output.json(await getClient().listAiSystemAssets({
      assetType: opts.type, sourceSystem: opts.source, lifecycleState: opts.state,
      limit: Number(opts.limit), offset: Number(opts.offset),
    })));

  assets.command("show <id>")
    .description("Show one asset and its reviewed relationships")
    .action(async (id: string) => output.json(await getClient().getAiSystemAsset(id)));
}
