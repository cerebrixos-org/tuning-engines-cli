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
exports.registerApprovalCommands = registerApprovalCommands;
const output = __importStar(require("../output"));
function printResult(result, asJson) {
    output.json(result);
}
function registerApprovalCommands(program, getClient) {
    const approvals = program
        .command("approvals")
        .description("List and review policy approval requests");
    approvals
        .command("list")
        .description("List approval requests for the current tenant")
        .option("--status <status>", "pending, approved, denied, or expired")
        .option("-l, --limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const result = await getClient().listApprovals({
                status: opts.status,
                limit: Number(opts.limit),
                offset: Number(opts.offset),
            });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    approvals
        .command("show <id>")
        .description("Show an approval request")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().getApproval(id);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    approvals
        .command("approve <id>")
        .description("Approve a pending policy approval request")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().approveApproval(id);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    approvals
        .command("deny <id>")
        .description("Deny a pending policy approval request")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const result = await getClient().denyApproval(id);
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=approvals.js.map