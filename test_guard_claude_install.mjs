import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cli = path.join(process.cwd(), "dist", "cli.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "te-claude-install-"));

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      TE_API_KEY: options.apiKey ?? "sk-te-test-token-for-doctor",
    },
  });
  if (result.status !== 0) {
    const error = new Error(`Command failed: te ${args.join(" ")}`);
    error.status = result.status;
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }
  return `${result.stdout}${result.stderr}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const project = path.join(tmp, "disaster-management-rag");
fs.mkdirSync(project, { recursive: true });

const sibling = `${project}.claude`;
fs.mkdirSync(path.join(sibling, "commands"), { recursive: true });
fs.writeFileSync(path.join(sibling, "commands", "custom.md"), "# keep me\n");

const installOutput = run([
  "guard",
  "claude-code",
  "install",
  "--project",
  project,
  "--mode",
  "observe",
  "--migrate-sibling",
]);

const settingsPath = path.join(project, ".claude", "settings.local.json");
assert.ok(fs.existsSync(settingsPath), "settings.local.json should be written under project/.claude");
assert.ok(!fs.existsSync(path.join(`${project}.claude`, "settings.local.json")), "install must not write settings into sibling project.claude");
assert.ok(fs.existsSync(path.join(project, ".claude", "commands", "custom.md")), "migrate-sibling should copy missing sibling commands");
assert.match(installOutput, /Warning: found .*disaster-management-rag\.claude/);
assert.match(installOutput, /dir \.\\\.claude/);
assert.match(installOutput, /claude \/hooks/);

const settings = readJson(settingsPath);
for (const event of ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure", "Stop"]) {
  assert.ok(Array.isArray(settings.hooks[event]), `${event} hook should be installed`);
  assert.ok(
    settings.hooks[event].some((entry) =>
      Array.isArray(entry.hooks) && entry.hooks.some((hook) => String(hook.command).includes(`te guard claude-code hook --event ${event}`))
    ),
    `${event} hook should call te guard`
  );
}

const doctor = JSON.parse(run(["guard", "claude-code", "doctor", "--project", project, "--json"]));
assert.equal(doctor.ok, true, "doctor should pass with installed hooks");
assert.equal(doctor.project_dir, project);
assert.equal(doctor.settings_path, settingsPath);
assert.ok(doctor.checks.some((check) => check.check === "Wrong sibling folder detected" && check.level === "warn"));

const nestedClaudeProject = path.join(tmp, "nested", ".claude");
fs.mkdirSync(nestedClaudeProject, { recursive: true });
const nestedOutput = run(["guard", "claude-code", "install", "--project", nestedClaudeProject, "--mode", "observe"]);
assert.match(nestedOutput, /using its parent project directory/);
assert.ok(fs.existsSync(path.join(tmp, "nested", ".claude", "settings.local.json")), "--project .claude should still write inside that .claude folder via parent resolution");

const brokenProject = path.join(tmp, "broken");
fs.mkdirSync(`${brokenProject}.claude`, { recursive: true });
let failed = false;
try {
  run(["guard", "claude-code", "doctor", "--project", brokenProject, "--json"]);
} catch (err) {
  failed = true;
  const payload = JSON.parse(err.stdout.toString());
  assert.equal(payload.ok, false);
  assert.ok(payload.checks.some((check) => check.level === "fail" && check.check === "Project .claude folder"));
}
assert.equal(failed, true, "doctor should fail when only sibling project.claude exists");

console.log("Claude Code guard install tests passed");
