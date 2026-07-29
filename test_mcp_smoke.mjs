import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/cli.js", "mcp", "serve"],
  env: { ...process.env, TE_API_URL: "http://127.0.0.1:1" },
});
const client = new Client({ name: "te-release-smoke", version: "1.0.0" });

try {
  await client.connect(transport);
  const result = await client.listTools();
  if (!Array.isArray(result.tools) || result.tools.length < 20) {
    throw new Error(`Expected at least 20 tools, received ${result.tools?.length ?? 0}`);
  }
  const names = new Set(result.tools.map((tool) => tool.name));
  for (const expected of [
    "call_inference",
    "send_agent_message",
    "list_skills",
    "invoke_skill",
    "list_runtime_interventions",
    "show_runtime_intervention",
    "list_runtime_state_references",
    "show_runtime_state_reference",
    "show_registry_sync",
    "registry_sync_dry_run",
    "list_work_sessions",
    "show_work_session",
    "list_compliance_risks",
    "show_compliance_risk",
    "validate_compliance",
  ]) {
    if (!names.has(expected)) throw new Error(`Missing MCP tool ${expected}`);
  }
  for (const writeTool of [
    "create_runtime_intervention",
    "upsert_runtime_state_reference",
    "registry_sync_apply",
    "create_compliance_source_run",
  ]) {
    if (names.has(writeTool)) throw new Error(`Write tool ${writeTool} must be opt-in`);
  }
  console.log(`MCP initialized and listed ${result.tools.length} tools`);
} finally {
  await client.close();
}
