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
exports.registerComplianceCommands = registerComplianceCommands;
const output = __importStar(require("../output"));
function jsonObject(raw, label = "data") {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label} must be a JSON object`);
    }
    return value;
}
function run(action) {
    action().then(output.json).catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
function registerComplianceCommands(program, getClient) {
    const compliance = program
        .command("compliance")
        .description("Automate compliance decisions, risks, evidence ingestion, and certifications");
    for (const action of ["validate", "rewrite"]) {
        compliance.command(action)
            .description(`${action === "validate" ? "Validate" : "Safely rewrite"} content against adopted compliance rulepacks`)
            .requiredOption("--data <json>", "Compliance request JSON")
            .action((opts) => run(() => action === "validate"
            ? getClient().validateCompliance(jsonObject(opts.data))
            : getClient().rewriteCompliance(jsonObject(opts.data))));
    }
    compliance.command("evidence <id>")
        .description("Show one compliance evidence decision")
        .action((id) => run(() => getClient().getComplianceEvidence(id)));
    const risks = compliance.command("risks").description("Manage the tenant risk register");
    risks.command("list")
        .option("--status <status>")
        .option("--category <category>")
        .option("--limit <n>", "Max results", "100")
        .option("--offset <n>", "Offset", "0")
        .action((opts) => run(() => getClient().listComplianceRisks({
        status: opts.status,
        category: opts.category,
        limit: Number(opts.limit),
        offset: Number(opts.offset),
    })));
    risks.command("show <id>")
        .action((id) => run(() => getClient().getComplianceRisk(id)));
    risks.command("create")
        .requiredOption("--data <json>", "Risk payload including risk and subjects")
        .action((opts) => run(() => getClient().createComplianceRisk(jsonObject(opts.data))));
    risks.command("update <id>")
        .requiredOption("--data <json>", "Risk update payload")
        .action((id, opts) => run(() => getClient().updateComplianceRisk(id, jsonObject(opts.data))));
    risks.command("assess <id>")
        .requiredOption("--data <json>", "assessment_type, likelihood, impact, and rationale")
        .action((id, opts) => run(() => getClient().assessComplianceRisk(id, jsonObject(opts.data))));
    risks.command("map-control <id>")
        .requiredOption("--control-id <id>", "Published control public ID")
        .option("--relationship <value>", "required, supporting, or compensating", "supporting")
        .option("--weight <n>", "Mitigation weight", "1")
        .option("--rationale <text>")
        .action((id, opts) => run(() => getClient().mapComplianceRiskControl(id, {
        control_id: opts.controlId,
        relationship: opts.relationship,
        mitigation_weight: Number(opts.weight),
        rationale: opts.rationale,
    })));
    risks.command("add-subject <id>")
        .requiredOption("--subject <token>", "Tenant resource token")
        .action((id, opts) => run(() => getClient().addComplianceRiskSubject(id, opts.subject)));
    risks.command("remove-subject <id>")
        .requiredOption("--subject-id <id>", "Risk subject mapping ID")
        .action((id, opts) => run(() => getClient().removeComplianceRiskSubject(id, opts.subjectId)));
    const sourceRuns = compliance.command("source-runs")
        .description("Ingest normalized results from Prowler, Steampipe, webhooks, and external scanners");
    sourceRuns.command("create")
        .requiredOption("--data <json>", "connection_id, optional test_ids/source_run_id/timeout_minutes")
        .action((opts) => run(() => getClient().createComplianceSourceRun(jsonObject(opts.data))));
    sourceRuns.command("show <id>")
        .action((id) => run(() => getClient().getComplianceSourceRun(id)));
    sourceRuns.command("submit-results <id>")
        .requiredOption("--data <json>", "Normalized result contract payload")
        .action((id, opts) => run(() => getClient().submitComplianceSourceResults(id, jsonObject(opts.data))));
    sourceRuns.command("complete <id>")
        .option("--completeness <value>", "complete, partial, truncated, or cancelled", "complete")
        .action((id, opts) => run(() => getClient().completeComplianceSourceRun(id, opts.completeness)));
    const certifications = compliance.command("certifications").description("Run and inspect compliance certifications");
    certifications.command("create")
        .option("--framework <key>", "Framework key", "eu_ai_act")
        .option("--range <range>", "7d, 30d, or 90d", "30d")
        .option("--model <model>")
        .option("--user-id <id>")
        .action((opts) => run(() => getClient().createComplianceCertification({
        framework_key: opts.framework,
        range: opts.range,
        model: opts.model,
        user_id: opts.userId,
    })));
    certifications.command("show <id>")
        .action((id) => run(() => getClient().getComplianceCertification(id)));
}
//# sourceMappingURL=compliance.js.map