import { Command } from "commander";
import { TuningEnginesClient } from "../client";
import * as output from "../output";

function collection(result: any): any[] {
  return Array.isArray(result?.agent_insights) ? result.agent_insights : Array.isArray(result?.data) ? result.data : Array.isArray(result?.insights) ? result.insights : [];
}

export function registerInsightCommands(
  program: Command,
  getClient: () => TuningEnginesClient
): void {
  const insights = program
    .command("insights")
    .description("List, review, accept, and apply Insight Loop recommendations");

  insights
    .command("list")
    .description("List Insight Loop recommendations")
    .option("--limit <n>", "Maximum insights (default 20)", (v) => Number(v))
    .option("--offset <n>", "Offset", (v) => Number(v))
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const result = await getClient().listInsights({
          limit: opts.limit || 20,
          offset: opts.offset,
        });
        const rows = collection(result);
        if (opts.json) {
          output.json(result);
          return;
        }
        if (rows.length === 0) {
          console.log("No insights found.");
          return;
        }
        output.table(
          ["ID", "Status", "Type", "Title", "Updated"],
          rows.map((insight: any) => [
            String(insight.id || insight.public_id || "-"),
            String(insight.status || "-"),
            String(insight.insight_type || insight.type || "-"),
            String(insight.title || "-"),
            insight.updated_at ? new Date(insight.updated_at).toLocaleString() : "-",
          ])
        );
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  insights
    .command("show <id>")
    .description("Show one Insight Loop recommendation")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().getInsight(id);
        output.json(opts.json ? result : result.data || result);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  insights
    .command("accept <id>")
    .description("Accept an insight as valid for review; does not change production")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().acceptInsight(id);
        if (opts.json) {
          output.json(result);
        } else {
          console.log(`Accepted insight ${id}. No production change was made.`);
        }
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  insights
    .command("apply <id>")
    .description("Apply or queue the approved action for an accepted insight")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const result = await getClient().applyInsight(id);
        if (opts.json) {
          output.json(result);
        } else {
          console.log(`Applied or queued insight ${id}.`);
        }
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
