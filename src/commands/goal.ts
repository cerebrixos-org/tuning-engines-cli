import { randomUUID } from "crypto";
import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import { clearGoalContext, loadGoalContext, saveGoalContext, sourceSessionHash } from "../goal_context";
import * as output from "../output";

export function registerGoalCommands(program: Command, getClient: () => TuningEnginesClient): void {
  const goal = program.command("goal").description("Label the active outcome for this project");

  goal.command("start <title>").description("Label the desired outcome for future sessions")
    .option("--key <outcome_key>", "Stable shared outcome key").option("--json", "Output as JSON")
    .action(async (title, opts) => {
      try {
        const result = await getClient().createOutcomeContext({ title, outcome_key: opts.key, context_id: randomUUID() });
        const context = result.outcome_context;
        saveGoalContext({ outcome_context_id: context.id, title: context.title, outcome_key: context.outcome_key, project_dir: process.cwd(), source_session_hash: sourceSessionHash() });
        if (opts.json) output.json(result);
        else console.log(`Started outcome: ${context.title}\nOutcome key: ${context.outcome_key}\nTaxonomy: ${context.taxonomy_status}`);
      } catch (err: any) { console.error(err.message); process.exit(1); }
    });

  goal.command("set <title>").description("Replace the active desired outcome")
    .option("--key <outcome_key>", "Stable shared outcome key").action(async (title, opts) => {
      try {
        const previous = loadGoalContext();
        const result = await getClient().createOutcomeContext({ title, outcome_key: opts.key, context_id: previous?.outcome_context_id || randomUUID() });
        const context = result.outcome_context;
        saveGoalContext({ outcome_context_id: context.id, title: context.title, outcome_key: context.outcome_key, project_dir: process.cwd(), source_session_hash: sourceSessionHash() });
        console.log(`Updated outcome: ${context.title}`);
      } catch (err: any) { console.error(err.message); process.exit(1); }
    });

  goal.command("show").description("Show the active project outcome").option("--json", "Output as JSON").action((opts) => {
    const context = loadGoalContext();
    if (opts.json) output.json({ goal: context || null });
    else if (context) console.log(`${context.title}\nOutcome key: ${context.outcome_key || context.goal_key || "unlabeled"}${context.outcome_context_id ? `\nContext: ${context.outcome_context_id}` : ""}`);
    else console.log("No active project outcome. Start one with: te goal start \"Describe the result you want\"");
  });

  goal.command("complete").description("Record the observed result and clear local context")
    .option("--result <status>", "Observed result: succeeded, failed, partial, or unknown", "succeeded")
    .action(async (opts) => {
      try {
        const context = requireContext();
        if (context.outcome_context_id) await getClient().completeOutcomeContext({ context_id: context.outcome_context_id, result_status: opts.result });
        else if (context.work_item_id) await getClient().completeWorkItem(context.work_item_id);
        clearGoalContext();
        console.log(`Completed outcome: ${context.title}\nObserved result: ${opts.result}`);
      } catch (err: any) { console.error(err.message); process.exit(1); }
    });

  goal.command("clear").description("Clear local outcome context without recording a result").action(() => {
    clearGoalContext();
    console.log("Cleared the active local outcome.");
  });
}

function requireContext() {
  const context = loadGoalContext();
  if (!context) throw new Error("No active project outcome. Start one with: te goal start \"Describe the result you want\"");
  return context;
}
