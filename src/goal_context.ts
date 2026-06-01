import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface GoalContext {
  work_item_id?: string;
  outcome_context_id?: string;
  title: string;
  outcome_key?: string;
  goal_key?: string;
  project_dir: string;
  source_session_hash: string;
}

const SESSION_DIR = path.join(os.homedir(), ".tuningengines", "sessions");

function sha(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function resolvedProjectDir(projectDir?: string): string {
  return path.resolve(projectDir || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

function contextPath(projectDir?: string): string {
  return path.join(SESSION_DIR, `${sha(resolvedProjectDir(projectDir))}.json`);
}

export function sourceSessionHash(projectDir?: string): string {
  return sha(resolvedProjectDir(projectDir));
}

export function loadGoalContext(projectDir?: string): GoalContext | undefined {
  const file = contextPath(projectDir);
  if (!fs.existsSync(file)) return undefined;
  try {
    const context = JSON.parse(fs.readFileSync(file, "utf-8"));
    return context?.outcome_context_id || context?.work_item_id ? context : undefined;
  } catch {
    return undefined;
  }
}

export function saveGoalContext(context: GoalContext): void {
  fs.mkdirSync(SESSION_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(contextPath(context.project_dir), JSON.stringify(context, null, 2) + "\n", { mode: 0o600 });
}

export function clearGoalContext(projectDir?: string): void {
  const file = contextPath(projectDir);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function goalMetadata(projectDir?: string, fallbackSessionId?: string): Record<string, string> {
  const context = loadGoalContext(projectDir);
  if (!context) return { te_source_session_hash: sha(fallbackSessionId || resolvedProjectDir(projectDir)) };
  return {
    ...(context.work_item_id ? { te_work_item_id: context.work_item_id, work_item_id: context.work_item_id } : {}),
    outcome_context_id: context.outcome_context_id || "",
    outcome_key: context.outcome_key || context.goal_key || "",
    goal_text: context.title,
    goal_key: context.outcome_key || context.goal_key || "",
  };
}
