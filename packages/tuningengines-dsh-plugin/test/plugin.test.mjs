import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DurableTraceQueue, normalizeSessionEvent } from "../index.js";

test("tool proposal and result share a stable tool call identity without raw content", () => {
  const session = { id: "session-123" };
  const proposed = normalizeSessionEvent(session, {
    type: "tool/call", seq: 4, time: 1, data: { turn: 1, step: 2, callId: "call-7", name: "bash", arguments: '{"command":"echo secret"}' },
  });
  const completed = normalizeSessionEvent(session, {
    type: "tool/result", seq: 5, time: 2, data: { turn: 1, step: 2, message: { content: [{ type: "tool-result", toolCallId: "call-7", content: [{ type: "text", text: "secret output" }] }] } },
  });

  assert.equal(proposed.event.id, completed.event.parent_id);
  assert.equal(proposed.event.metadata.tool_call_id, "call-7");
  assert.equal(completed.event.metadata.tool_call_id, "call-7");
  assert.ok(proposed.event.metadata.arguments_sha256.startsWith("sha256:"));
  assert.doesNotMatch(JSON.stringify(proposed), /echo secret/);
  assert.doesNotMatch(JSON.stringify(completed), /secret output/);
});

test("failed tool results are normalized as failed", () => {
  const normalized = normalizeSessionEvent({ id: "session-123" }, {
    type: "tool/result", seq: 6, data: { turn: 1, step: 2, error: { name: "ExitError", code: "NON_ZERO_EXIT" }, message: { content: [{ type: "tool-result", toolCallId: "call-7", isError: true, content: [] }] } },
  });
  assert.equal(normalized.event.status, "failed");
  assert.equal(normalized.event.metadata.error_code, "NON_ZERO_EXIT");
});

test("durable queue retains events when delivery fails", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "te-dsh-"));
  const spoolPath = path.join(directory, "spool.jsonl");
  const queue = new DurableTraceQueue({ apiUrl: "https://invalid.example", apiKey: "test", spoolPath, maxBatchSize: 10 });
  queue.enqueue(normalizeSessionEvent({ id: "session-123" }, { type: "turn/start", seq: 1, data: { turn: 1 } }));
  queue.post = async () => { throw new Error("offline"); };
  await assert.rejects(() => queue.flush(), /offline/);
  assert.equal(queue.read().length, 1);
});
