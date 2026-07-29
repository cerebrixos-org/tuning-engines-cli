import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { TuningEnginesClient } from "./dist/client.js";
import { callInference } from "./dist/inference_request.js";

const seen = [];
const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
  seen.push({ method: request.method, url: request.url, body, authorization: request.headers.authorization });

  response.setHeader("Content-Type", "application/json");
  if (request.url === "/api/v1/auth/token") {
    response.end(JSON.stringify({ access_token: "jwt-test", expires_in: 900 }));
    return;
  }
  response.end(JSON.stringify({ ok: true }));
});
server.listen(0, "127.0.0.1");
await once(server, "listening");

try {
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const client = new TuningEnginesClient({ apiKey: "te_test", apiUrl: base });

  await client.createRuntimeIntervention("run-1", { kind: "pause", reason: "review" });
  assert.equal(seen.at(-1).url, "/api/v1/runtime_interventions");
  assert.deepEqual(seen.at(-1).body, { run_id: "run-1", kind: "pause", reason: "review" });

  await client.getRuntimeIntervention("ri_1");
  assert.equal(seen.at(-1).url, "/api/v1/runtime_interventions/ri_1");

  await client.getRuntimeStateReference("42");
  assert.equal(seen.at(-1).url, "/api/v1/runtime_state_references/42");

  await client.listComplianceRisks({ status: "open", limit: 25 });
  assert.equal(seen.at(-1).url, "/api/v1/compliance/risks?status=open&limit=25");

  await callInference("/chat/completions", { model: "demo", messages: [] }, "sk-te-test", {
    baseUrl: `${base}/v1`,
  });
  assert.equal(seen.at(-1).url, "/v1/chat/completions");
  assert.equal(seen.at(-1).authorization, "Bearer sk-te-test");

  await assert.rejects(
    () => callInference("/internal/tenant_config", {}, "sk-te-test", { baseUrl: `${base}/v1` }),
    /Unsupported inference endpoint/
  );

  console.log("Client parity tests passed");
} finally {
  server.close();
}
