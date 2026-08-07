"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTrajectoryCommands = registerTrajectoryCommands;
const output = __importStar(require("../output"));
function registerTrajectoryCommands(program, getClient) {
    const trajectory = program.command("trajectory").description("Curate immutable evidence and run trajectory intelligence");
    const studies = trajectory.command("studies").description("Compare models, agents, prompts, tools, policies, context, or runtimes");
    studies.command("list")
        .option("-l, --limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .action(async (opts) => output.json(await getClient().listComparisonStudies({ limit: Number(opts.limit), offset: Number(opts.offset) })));
    studies.command("show <id>")
        .action(async (id) => output.json(await getClient().getComparisonStudy(id)));
    studies.command("create")
        .requiredOption("--initiative <id>", "Initiative public ID")
        .requiredOption("--name <name>", "Study name")
        .requiredOption("--field <field>", "Variant field, for example model or runtime")
        .requiredOption("--a <value>", "Variant A match value")
        .requiredOption("--b <value>", "Variant B match value")
        .option("--type <type>", "Comparison question type", "custom")
        .option("--a-label <label>", "Variant A display label", "Variant A")
        .option("--b-label <label>", "Variant B display label", "Variant B")
        .option("--evaluation-profile <id>", "Common quality evaluation profile public ID")
        .option("--filters <json>", "Population filters", "{}")
        .option("--metrics <list>", "Comma-separated report metrics", "success_rate,quality_score,avg_cost_cents,p95_latency_ms,avg_duration_ms,avg_tool_calls,error_rate,retry_rate")
        .option("--weights <json>", "Optional metric weights", "{}")
        .option("--success-source <source>", "outcome, evaluation, or combined", "outcome")
        .option("--continuous", "Continuously refresh matching evidence")
        .action(async (opts) => output.json(await getClient().createComparisonStudy({
        initiative_id: opts.initiative, name: opts.name, question_type: opts.type,
        evaluation_profile_id: opts.evaluationProfile, continuous: Boolean(opts.continuous),
        population_filters: parseObject(opts.filters) || {},
        variants: [
            { key: "variant_a", label: opts.aLabel, match: { field: opts.field, operator: "equals", value: opts.a } },
            { key: "variant_b", label: opts.bLabel, match: { field: opts.field, operator: "equals", value: opts.b } },
        ],
        metric_config: { metrics: String(opts.metrics).split(",").map((value) => value.trim()).filter(Boolean), weights: parseObject(opts.weights) || {}, success_source: opts.successSource },
    })));
    studies.command("update <id>")
        .requiredOption("--data <json>", "Complete safe study update payload")
        .action(async (id, opts) => output.json(await getClient().updateComparisonStudy(id, parseObject(opts.data) || {})));
    studies.command("run <id>")
        .action(async (id) => output.json(await getClient().runComparisonStudy(id)));
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
        .action(async (id) => output.json(await getClient().previewTrajectorySelectionRule(id)));
    rules.command("freeze <id>")
        .option("--name <name>", "Evidence snapshot name")
        .action(async (id, opts) => output.json(await getClient().freezeTrajectorySelectionRule(id, opts.name)));
    evidence.command("list")
        .option("--initiative <id>", "Initiative public ID")
        .option("-l, --limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .action(async (opts) => output.json(await getClient().listEvidenceSets({
        initiativeId: opts.initiative, limit: Number(opts.limit), offset: Number(opts.offset),
    })));
    evidence.command("show <id>")
        .action(async (id) => output.json(await getClient().getEvidenceSet(id)));
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
        .action(async (id) => output.json(await getClient().getIntelligenceRun(id)));
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
function parseObject(raw) {
    if (!raw)
        return undefined;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Expected a JSON object");
    return value;
}
//# sourceMappingURL=trajectory.js.map