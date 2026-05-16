import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

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

function parseJsonObject(raw?: string): Record<string, any> {
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--data must be a JSON object");
  }
  return parsed;
}

function printResult(result: any, asJson: boolean): void {
  if (asJson) {
    output.json(result);
    return;
  }
  output.json(result);
}

function resourceHelp(): string {
  return `Allowed resources: ${RESOURCE_NAMES.join(", ")}`;
}

export function registerTenantCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
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
    .action(async (resource: string, opts) => {
      try {
        const result = await getClient().listTenantResource(resource, {
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  tenant
    .command("show <resource> <id>")
    .description(`Show a tenant resource. ${resourceHelp()}`)
    .option("--json", "Output as JSON")
    .action(async (resource: string, id: string, opts) => {
      try {
        const result = await getClient().getTenantResource(resource, id);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  tenant
    .command("create <resource>")
    .description(`Create a tenant resource from JSON. ${resourceHelp()}`)
    .requiredOption("--data <json>", "JSON object with resource attributes")
    .option("--json", "Output as JSON")
    .action(async (resource: string, opts) => {
      try {
        const result = await getClient().createTenantResource(resource, parseJsonObject(opts.data));
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  tenant
    .command("update <resource> <id>")
    .description(`Update a tenant resource from JSON. ${resourceHelp()}`)
    .requiredOption("--data <json>", "JSON object with changed attributes")
    .option("--json", "Output as JSON")
    .action(async (resource: string, id: string, opts) => {
      try {
        const result = await getClient().updateTenantResource(resource, id, parseJsonObject(opts.data));
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  tenant
    .command("delete <resource> <id>")
    .description(`Delete or revoke a tenant resource. Inference keys are revoked. ${resourceHelp()}`)
    .option("--json", "Output as JSON")
    .action(async (resource: string, id: string, opts) => {
      try {
        const result = await getClient().deleteTenantResource(resource, id);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  tenant
    .command("test-policy <id>")
    .description("Dry-run an AGT YAML governance policy against a JSON context")
    .requiredOption("--context <json>", "Policy evaluation context JSON object")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().testGovernancePolicy(id, parseJsonObject(opts.context));
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  const team = tenant.command("team").description("Manage tenant members and invitations");

  team
    .command("list")
    .description("List tenant members, invitations, and allowed email domains")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().getTenantTeam();
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  team
    .command("invite <email>")
    .description("Invite a tenant member. The invite token is emailed and is never printed.")
    .option("--role <role>", "admin, member, viewer, or numeric role", "member")
    .option("--json", "Output as JSON")
    .action(async (email: string, opts) => {
      try {
        const result = await getClient().inviteTenantMember({ email, role: opts.role });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  team
    .command("set-role <member-id>")
    .description("Set a member's inference role by ID")
    .requiredOption("--inference-role-id <id>", "Inference role ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().updateTenantMember(id, {
          inference_role_id: opts.inferenceRoleId,
        });
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  team
    .command("remove <member-id>")
    .description("Remove a tenant member")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().deleteTenantMember(id);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  team
    .command("disable <member-id>")
    .description("Disable a tenant member and block API access")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().setTenantMemberEnabled(id, false);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  team
    .command("enable <member-id>")
    .description("Re-enable a tenant member")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().setTenantMemberEnabled(id, true);
        printResult(result, opts.json);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  team
    .command("cancel-invite <invitation-id>")
    .description("Cancel a pending tenant invitation")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().cancelTenantInvitation(id);
        printResult(result, opts.json);
      } catch (err: any) {
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
      } catch (err: any) {
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
      } catch (err: any) {
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
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
