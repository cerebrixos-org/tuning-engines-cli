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
  console.log(`MCP initialized and listed ${result.tools.length} tools`);
} finally {
  await client.close();
}
