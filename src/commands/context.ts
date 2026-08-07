import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerContextCommands(program: Command, getClient: () => TuningEnginesClient): void {
  const context = program
    .command("context")
    .description("Resolve governed, versioned context for an agent turn");

  context
    .command("resolve <query>")
    .description("Resolve authorized context; observe mode returns lineage without injecting content")
    .option("--asset <id...>", "Restrict resolution to context asset IDs")
    .option("--goal-key <key>", "Stable goal key")
    .option("--entity <value...>", "Structured entity values")
    .option("--action <action>", "Requested action")
    .option("--sensitivity <level>", "Sensitivity classification")
    .option("--request-id <id>", "Request correlation ID")
    .option("--run-id <id>", "Run correlation ID")
    .option("--json", "Output as JSON")
    .action(async (query: string, opts) => {
      try {
        const result = await getClient().resolveContext({
          query,
          context_asset_ids: opts.asset,
          goal_key: opts.goalKey,
          entities: opts.entity,
          action: opts.action,
          sensitivity: opts.sensitivity,
          request_id: opts.requestId,
          run_id: opts.runId,
        });
        output.json(result);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  context.command("record-use")
    .description("Record accepted, rejected, deviated, or outcome feedback for resolved context")
    .requiredOption("--event <type>", "accepted, rejected, deviated, or outcome")
    .option("--receipt <id>", "Resolution receipt ID")
    .option("--mode <mode>", "Context mode", "suggest")
    .option("--request-id <id>", "Request correlation ID")
    .option("--run-id <id>", "Run correlation ID")
    .option("--goal-key <key>", "Goal key")
    .option("--asset <id...>", "Context asset IDs")
    .option("--version <id...>", "Context version IDs")
    .option("--outcome-key <key>", "Outcome key")
    .option("--outcome-status <status>", "succeeded, failed, or unknown")
    .option("--details <json>", "Safe bounded feedback details", "{}")
    .action(async (opts) => output.json(await getClient().recordContextUse({
      receipt_id: opts.receipt, event_type: opts.event, mode: opts.mode,
      request_id: opts.requestId, run_id: opts.runId, goal_key: opts.goalKey,
      asset_ids: opts.asset, version_ids: opts.version, outcome_key: opts.outcomeKey,
      outcome_status: opts.outcomeStatus, details: parseObject(opts.details),
    })));

  const assets = context.command("assets").description("Manage reviewed, versioned context assets");
  assets.command("list")
    .option("--type <type>", "Context type")
    .option("--status <status>", "Lifecycle status")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .action(async (opts) => output.json(await getClient().listContextAssets({
      contextType: opts.type, status: opts.status, limit: Number(opts.limit), offset: Number(opts.offset),
    })));

  assets.command("show <id>")
    .action(async (id: string) => output.json(await getClient().getContextAsset(id)));

  assets.command("create")
    .description("Create a disabled draft; this never activates context automatically")
    .requiredOption("--name <name>", "Context asset name")
    .requiredOption("--type <type>", "procedure, precedent, knowledge, policy_guidance, or deterministic_candidate")
    .requiredOption("--unit <json...>", "Bounded structured context units")
    .option("--citation <json...>", "Safe evidence citations")
    .option("--applicability <json>", "Structured applicability")
    .option("--asset <id>", "Optional AI system asset public ID")
    .action(async (opts) => output.json(await getClient().createContextAsset({
      name: opts.name, context_type: opts.type,
      structured_units: opts.unit.map(parseObject),
      citations: (opts.citation || []).map(parseObject),
      applicability: parseObject(opts.applicability) || {},
      ai_system_asset_id: opts.asset,
    })));

  assets.command("activate <id>")
    .description("Explicitly activate one reviewed context version")
    .requiredOption("--version <id>", "Context version public ID")
    .action(async (id: string, opts) => output.json(await getClient().activateContextAsset(id, opts.version)));

  assets.command("review <id>")
    .description("Review a draft version; deterministic candidates require an evidence-backed validation packet")
    .requiredOption("--version <id>", "Context version public ID")
    .option("--validation-packet <json>", "Replay/shadow/canary/deviation/rollback/compensation results")
    .action(async (id: string, opts) => output.json(await getClient().reviewContextAsset(
      id, opts.version, parseObject(opts.validationPacket || "{}"),
    )));
}

function parseObject(raw: string): Record<string, any> {
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value;
}
