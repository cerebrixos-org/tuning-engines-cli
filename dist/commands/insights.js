"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInsightCommands = registerInsightCommands;
const output = __importStar(require("../output"));
function collection(result) {
    return Array.isArray(result?.agent_insights) ? result.agent_insights : Array.isArray(result?.data) ? result.data : Array.isArray(result?.insights) ? result.insights : [];
}
function registerInsightCommands(program, getClient) {
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
            output.table(["ID", "Status", "Type", "Title", "Updated"], rows.map((insight) => [
                String(insight.id || insight.public_id || "-"),
                String(insight.status || "-"),
                String(insight.insight_type || insight.type || "-"),
                String(insight.title || "-"),
                insight.updated_at ? new Date(insight.updated_at).toLocaleString() : "-",
            ]));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    insights
        .command("show <id>")
        .description("Show one Insight Loop recommendation")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().getInsight(id);
            output.json(opts.json ? result : result.data || result);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    insights
        .command("accept <id>")
        .description("Accept an insight as valid for review; does not change production")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().acceptInsight(id);
            if (opts.json) {
                output.json(result);
            }
            else {
                console.log(`Accepted insight ${id}. No production change was made.`);
            }
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    insights
        .command("apply <id>")
        .description("Apply or queue the approved action for an accepted insight")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().applyInsight(id);
            if (opts.json) {
                output.json(result);
            }
            else {
                console.log(`Applied or queued insight ${id}.`);
            }
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=insights.js.map