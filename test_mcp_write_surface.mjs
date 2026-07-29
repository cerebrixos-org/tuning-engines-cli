import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/cli.js", "mcp", "serve", "--enable-registry-writes"],
  env: { ...process.env, TE_API_URL: "http://127.0.0.1:1" },
});
const client = new Client({ name: "te-write-surface-smoke", version: "1.0.0" });

try {
  await client.connect(transport);
  const names = new Set((await client.listTools()).tools.map((tool) => tool.name));
  for (const expected of [
    "create_runtime_intervention",
    "ack_runtime_intervention",
    "complete_runtime_intervention",
    "fail_runtime_intervention",
    "upsert_runtime_state_reference",
    "registry_sync_dry_run",
    "registry_sync_apply",
    "install_mcp_template",
    "complete_work_session",
    "preview_work_session_repair",
    "apply_work_session_repair",
    "undo_work_session_repair",
    "record_inference_feedback",
    "propose_outcome",
    "create_compliance_source_run",
    "submit_compliance_source_results",
    "complete_compliance_source_run",
    "flush_inference_capture",
    "retry_tenant_resource_sync",
    "verify_tenant_secret_reference",
  ]) {
    if (!names.has(expected)) throw new Error(`Missing opt-in MCP write tool ${expected}`);
  }
  console.log(`MCP write surface initialized with ${names.size} tools`);
} finally {
  await client.close();
}
