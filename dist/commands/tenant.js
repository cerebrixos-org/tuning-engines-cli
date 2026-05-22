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
exports.registerTenantCommands = registerTenantCommands;
const output = __importStar(require("../output"));
const RESOURCE_NAMES = [
    "inference_keys",
    "inference_roles",
    "model_deployments",
    "routing_profiles",
    "guardrail_policies",
    "governance_policies",
    "mcp_servers",
    "tenant_agents",
    "tenant_skills",
    "credential_sources",
];
const TYPED_RESOURCES = [
    { command: "keys", resource: "inference_keys", label: "inference keys", validates: false },
    { command: "roles", resource: "inference_roles", label: "inference roles", validates: false },
    { command: "models", resource: "model_deployments", label: "model deployments", validates: false },
    { command: "routing-profiles", resource: "routing_profiles", label: "routing profiles", validates: false },
    { command: "guardrails", resource: "guardrail_policies", label: "guardrail policies", validates: true },
    { command: "governance-policies", resource: "governance_policies", label: "AGT governance policies", validates: true },
    { command: "mcp-servers", resource: "mcp_servers", label: "MCP servers", validates: true },
    { command: "agents", resource: "tenant_agents", label: "tenant agents", validates: true },
    { command: "skills", resource: "tenant_skills", label: "tenant skills", validates: true },
    { command: "credential-sources", resource: "credential_sources", label: "credential sources", validates: false },
];
function parseJsonObject(raw) {
    if (!raw)
        return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Expected a JSON object");
    }
    return parsed;
}
function printResult(result, asJson) {
    if (asJson) {
        output.json(result);
        return;
    }
    output.json(result);
}
function resourceHelp() {
    return `Allowed resources: ${RESOURCE_NAMES.join(", ")}`;
}
function registerTypedResourceCommands(tenant, getClient) {
    for (const config of TYPED_RESOURCES) {
        const group = tenant
            .command(config.command)
            .description(`Manage ${config.label}`);
        group
            .command("list")
            .description(`List ${config.label}`)
            .option("-l, --limit <n>", "Max results", "50")
            .option("--offset <n>", "Offset", "0")
            .option("--json", "Output as JSON")
            .action(async (opts) => {
            try {
                const result = await getClient().listTenantResource(config.resource, {
                    limit: Number(opts.limit),
                    offset: Number(opts.offset),
                });
                printResult(result, opts.json);
            }
            catch (err) {
                console.error(err.message);
                process.exit(1);
            }
        });
        group
            .command("show <id>")
            .description(`Show one ${config.label} record`)
            .option("--json", "Output as JSON")
            .action(async (id, opts) => {
            try {
                printResult(await getClient().getTenantResource(config.resource, id), opts.json);
            }
            catch (err) {
                console.error(err.message);
                process.exit(1);
            }
        });
        group
            .command("create")
            .description(`Create ${config.label} from JSON`)
            .requiredOption("--data <json>", "JSON object with resource attributes")
            .option("--json", "Output as JSON")
            .action(async (opts) => {
            try {
                printResult(await getClient().createTenantResource(config.resource, parseJsonObject(opts.data)), opts.json);
            }
            catch (err) {
                console.error(err.message);
                process.exit(1);
            }
        });
        group
            .command("update <id>")
            .description(`Update ${config.label} from JSON`)
            .requiredOption("--data <json>", "JSON object with changed attributes")
            .option("--json", "Output as JSON")
            .action(async (id, opts) => {
            try {
                printResult(await getClient().updateTenantResource(config.resource, id, parseJsonObject(opts.data)), opts.json);
            }
            catch (err) {
                console.error(err.message);
                process.exit(1);
            }
        });
        group
            .command("delete <id>")
            .description(`Delete or revoke ${config.label}`)
            .option("--json", "Output as JSON")
            .action(async (id, opts) => {
            try {
                printResult(await getClient().deleteTenantResource(config.resource, id), opts.json);
            }
            catch (err) {
                console.error(err.message);
                process.exit(1);
            }
        });
        if (config.validates) {
            group
                .command("validate")
                .description(`Validate unsaved ${config.label} JSON`)
                .requiredOption("--data <json>", "JSON object with resource attributes")
                .option("--sample-text <text>", "Sample text for guardrail policy validation")
                .option("--context <json>", "Policy context JSON for AGT governance policy validation")
                .option("--json", "Output as JSON")
                .action(async (opts) => {
                try {
                    const data = parseJsonObject(opts.data);
                    if (opts.sampleText)
                        data.sample_text = opts.sampleText;
                    if (opts.context)
                        data.context = parseJsonObject(opts.context);
                    printResult(await getClient().validateTenantResource(config.resource, data), opts.json);
                }
                catch (err) {
                    console.error(err.message);
                    process.exit(1);
                }
            });
        }
    }
}
function registerTenantCommands(program, getClient) {
    const tenant = program
        .command("tenant")
        .description("Tenant-admin automation APIs for CI and product smoke tests");
    tenant
        .command("resources")
        .description("List tenant-admin resource names supported by the API")
        .action(() => {
        RESOURCE_NAMES.forEach((name) => console.log(name));
        console.log("team");
        console.log("inference_capture");
    });
    tenant
        .command("list <resource>")
        .description(`List a tenant resource. ${resourceHelp()}`)
        .option("-l, --limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .option("--json", "Output as JSON")
        .action(async (resource, opts) => {
        try {
            const result = await getClient().listTenantResource(resource, {
                limit: Number(opts.limit),
                offset: Number(opts.offset),
            });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    tenant
        .command("show <resource> <id>")
        .description(`Show a tenant resource. ${resourceHelp()}`)
        .option("--json", "Output as JSON")
        .action(async (resource, id, opts) => {
        try {
            const result = await getClient().getTenantResource(resource, id);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    tenant
        .command("create <resource>")
        .description(`Create a tenant resource from JSON. ${resourceHelp()}`)
        .requiredOption("--data <json>", "JSON object with resource attributes")
        .option("--json", "Output as JSON")
        .action(async (resource, opts) => {
        try {
            const result = await getClient().createTenantResource(resource, parseJsonObject(opts.data));
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    tenant
        .command("update <resource> <id>")
        .description(`Update a tenant resource from JSON. ${resourceHelp()}`)
        .requiredOption("--data <json>", "JSON object with changed attributes")
        .option("--json", "Output as JSON")
        .action(async (resource, id, opts) => {
        try {
            const result = await getClient().updateTenantResource(resource, id, parseJsonObject(opts.data));
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    tenant
        .command("delete <resource> <id>")
        .description(`Delete or revoke a tenant resource. Inference keys are revoked. ${resourceHelp()}`)
        .option("--json", "Output as JSON")
        .action(async (resource, id, opts) => {
        try {
            const result = await getClient().deleteTenantResource(resource, id);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    tenant
        .command("validate <resource>")
        .description(`Validate an unsaved tenant policy resource from JSON. ${resourceHelp()}`)
        .requiredOption("--data <json>", "JSON object with resource attributes")
        .option("--sample-text <text>", "Sample text for guardrail policy validation")
        .option("--context <json>", "Policy context JSON for AGT governance policy validation")
        .option("--json", "Output as JSON")
        .action(async (resource, opts) => {
        try {
            const data = parseJsonObject(opts.data);
            if (opts.sampleText)
                data.sample_text = opts.sampleText;
            if (opts.context)
                data.context = parseJsonObject(opts.context);
            const result = await getClient().validateTenantResource(resource, data);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    tenant
        .command("test-policy <id>")
        .description("Dry-run an AGT YAML governance policy against a JSON context")
        .requiredOption("--context <json>", "Policy evaluation context JSON object")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().testGovernancePolicy(id, parseJsonObject(opts.context));
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    registerTypedResourceCommands(tenant, getClient);
    const team = tenant.command("team").description("Manage tenant members and invitations");
    team
        .command("list")
        .description("List tenant members, invitations, and allowed email domains")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const result = await getClient().getTenantTeam();
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    team
        .command("invite <email>")
        .description("Invite a tenant member. The invite token is emailed and is never printed.")
        .option("--role <role>", "admin, member, viewer, or numeric role", "member")
        .option("--json", "Output as JSON")
        .action(async (email, opts) => {
        try {
            const result = await getClient().inviteTenantMember({ email, role: opts.role });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    team
        .command("set-role <member-id>")
        .description("Set a member's inference role by ID")
        .requiredOption("--inference-role-id <id>", "Inference role ID")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().updateTenantMember(id, {
                inference_role_id: opts.inferenceRoleId,
            });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    team
        .command("remove <member-id>")
        .description("Remove a tenant member")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().deleteTenantMember(id);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    team
        .command("disable <member-id>")
        .description("Disable a tenant member and block API access")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().setTenantMemberEnabled(id, false);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    team
        .command("enable <member-id>")
        .description("Re-enable a tenant member")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().setTenantMemberEnabled(id, true);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    team
        .command("cancel-invite <invitation-id>")
        .description("Cancel a pending tenant invitation")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().cancelTenantInvitation(id);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    team
        .command("domains")
        .description("Replace allowed email domains. Pass an empty string to clear.")
        .requiredOption("--set <domains>", "Comma-separated domain list")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const domains = String(opts.set)
                .split(",")
                .map((domain) => domain.trim().toLowerCase())
                .filter(Boolean);
            const result = await getClient().updateTenantDomains(domains);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    const capture = tenant.command("capture").description("Manage inference capture settings");
    capture
        .command("show")
        .description("Show inference capture config")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const result = await getClient().getInferenceCaptureConfig();
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    capture
        .command("update")
        .description("Update inference capture config from JSON")
        .requiredOption("--data <json>", "JSON object with capture settings")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const result = await getClient().updateInferenceCaptureConfig(parseJsonObject(opts.data));
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=tenant.js.map