import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

export function registerTrajectoryCommands(program: Command, getClient: () => TuningEnginesClient): void {
  const trajectory = program.command("trajectory").description("Curate immutable evidence and run trajectory intelligence");
  const evidence = trajectory.command("evidence").description("Manage immutable Initiative evidence sets");

  const rules = trajectory.command("rules").description("Manage saved, versioned source-selection rules");
  rules.command("list")
    .option("--initiative <id>", "Initiative public ID")
    .action(async (opts) => output.json(await getClient().listTrajectorySelectionRules({ initiativeId: opts.initiative })));
  rules.command("create")
    .requiredOption("--initiative <id>", "Initiative public ID")
    .requiredOption("--name <name>", "Rule name")
    .option("--mode <mode>", "rule, ai_ranked, hybrid, or continuous", "rule")
    .option("--role <role>", "positive, negative, comparison, context, exception, or validation", "context")
    .option("--filters <json>", "Safe source filters", "{}")
    .option("--limit <n>", "Candidate limit", "250")
    .option("--refresh-minutes <n>", "Continuous refresh interval")
    .action(async (opts) => output.json(await getClient().createTrajectorySelectionRule({
      initiative_id: opts.initiative, name: opts.name, selection_mode: opts.mode,
      evidence_role: opts.role, filters: parseObject(opts.filters), candidate_limit: Number(opts.limit),
      refresh_interval_minutes: opts.refreshMinutes ? Number(opts.refreshMinutes) : undefined,
    })));
  rules.command("preview <id>")
    .action(async (id: string) => output.json(await getClient().previewTrajectorySelectionRule(id)));
  rules.command("freeze <id>")
    .option("--name <name>", "Evidence snapshot name")
    .action(async (id: string, opts) => output.json(await getClient().freezeTrajectorySelectionRule(id, opts.name)));

  evidence.command("list")
    .option("--initiative <id>", "Initiative public ID")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .action(async (opts) => output.json(await getClient().listEvidenceSets({
      initiativeId: opts.initiative, limit: Number(opts.limit), offset: Number(opts.offset),
    })));

  evidence.command("show <id>")
    .action(async (id: string) => output.json(await getClient().getEvidenceSet(id)));

  evidence.command("freeze")
    .description("Freeze reviewed Work Sessions into an immutable evidence version")
    .requiredOption("--initiative <id>", "Initiative public ID")
    .requiredOption("--work-item <id...>", "Work Session public IDs")
    .option("--name <name>", "Evidence set name")
    .option("--filter-snapshot <json>", "Safe structured selection metadata")
    .action(async (opts) => output.json(await getClient().createEvidenceSet({
      initiative_id: opts.initiative, work_item_ids: opts.workItem,
      name: opts.name, filter_snapshot: parseObject(opts.filterSnapshot),
    })));

  evidence.command("preview")
    .description("Preview selected Work Sessions and automatically correlated evidence without freezing")
    .requiredOption("--initiative <id>", "Initiative public ID")
    .requiredOption("--work-item <id...>", "Work Session public IDs")
    .action(async (opts) => output.json(await getClient().previewEvidenceSet({
      initiative_id: opts.initiative, work_item_ids: opts.workItem,
    })));

  const runs = trajectory.command("runs").description("Run reproducible trajectory intelligence");
  runs.command("list")
    .option("--type <type>", "Run type")
    .option("--status <status>", "Run status")
    .option("-l, --limit <n>", "Max results", "50")
    .option("--offset <n>", "Offset", "0")
    .action(async (opts) => output.json(await getClient().listIntelligenceRuns({
      runType: opts.type, status: opts.status, limit: Number(opts.limit), offset: Number(opts.offset),
    })));

  runs.command("show <id>")
    .action(async (id: string) => output.json(await getClient().getIntelligenceRun(id)));

  runs.command("start")
    .description("Queue a versioned intelligence run; generated opportunities remain review-only")
    .requiredOption("--initiative <id>", "Initiative public ID")
    .requiredOption("--type <type>", "opportunity_scan, outcome_analysis, asset_evaluation, trajectory_comparison, trajectory_analysis, context_extraction, output_generation, or validation")
    .option("--evidence-set <id>", "Frozen evidence set public ID")
    .option("--parameters <json>", "Safe bounded run parameters")
    .action(async (opts) => output.json(await getClient().createIntelligenceRun({
      initiative_id: opts.initiative, run_type: opts.type,
      evidence_set_id: opts.evidenceSet, parameters: parseObject(opts.parameters),
    })));
}

function parseObject(raw?: string): Record<string, any> | undefined {
  if (!raw) return undefined;
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value;
}
