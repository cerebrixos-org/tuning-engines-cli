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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBulkImportCommands = registerBulkImportCommands;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml_1 = __importDefault(require("yaml"));
const output = __importStar(require("../output"));
const TARGET_TYPES = ["McpServer", "TenantAgent", "TenantSkill"];
function printResult(result, asJson) {
    if (asJson) {
        output.json(result);
        return;
    }
    output.json(result);
}
function readRows(filePath) {
    const resolved = path.resolve(filePath);
    const parsed = yaml_1.default.parse(fs.readFileSync(resolved, "utf8"));
    const rows = Array.isArray(parsed) ? parsed : parsed?.rows;
    if (!Array.isArray(rows)) {
        throw new Error("Bulk import file must be an array or an object with a rows array");
    }
    return rows.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
            throw new Error("Every bulk import row must be an object");
        }
        return row;
    });
}
function registerBulkImportCommands(program, getClient) {
    const bulk = program
        .command("bulk-import")
        .description("Bulk import MCP servers, tenant agents, and tenant skills");
    bulk
        .command("list")
        .description("List recent bulk imports")
        .option("-l, --limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const result = await getClient().listBulkImports({
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
    bulk
        .command("show <id>")
        .description("Show a bulk import result")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            printResult(await getClient().getBulkImport(id), opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    bulk
        .command("run")
        .description("Validate or apply a YAML/JSON bulk import file")
        .requiredOption("--target <type>", `Target type: ${TARGET_TYPES.join(", ")}`)
        .requiredOption("--file <path>", "YAML or JSON file containing rows")
        .option("--dry-run", "Validate without creating records")
        .option("--apply", "Create records")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            if (!TARGET_TYPES.includes(opts.target)) {
                throw new Error(`--target must be one of: ${TARGET_TYPES.join(", ")}`);
            }
            if (opts.dryRun && opts.apply) {
                throw new Error("Choose only one of --dry-run or --apply");
            }
            const result = await getClient().createBulkImport({
                target_type: opts.target,
                rows: readRows(opts.file),
                dry_run: !opts.apply,
            });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=bulk-import.js.map