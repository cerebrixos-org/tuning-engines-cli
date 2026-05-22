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
exports.registerFileCommands = registerFileCommands;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const output = __importStar(require("../output"));
function printResult(result, asJson) {
    if (asJson) {
        output.json(result);
        return;
    }
    output.json(result);
}
function registerFileCommands(program, getClient) {
    const files = program
        .command("files")
        .description("Manage OpenAI-compatible files used by agents and inference workflows");
    files
        .command("list")
        .description("List uploaded files visible to the current user")
        .option("--purpose <purpose>", "Filter by purpose")
        .option("-l, --limit <n>", "Max results", "20")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const result = await getClient().listFiles({
                purpose: opts.purpose,
                limit: Number(opts.limit),
            });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    files
        .command("upload <path>")
        .description("Upload a file through the tenant-scoped Files API")
        .option("--purpose <purpose>", "OpenAI-compatible file purpose", "assistants")
        .option("--content-type <type>", "Declared content type", "application/octet-stream")
        .option("--json", "Output as JSON")
        .action(async (filePath, opts) => {
        try {
            const result = await getClient().uploadFile(filePath, {
                purpose: opts.purpose,
                contentType: opts.contentType,
            });
            printResult(result, opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    files
        .command("show <id>")
        .description("Show file metadata")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            printResult(await getClient().getFile(id), opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    files
        .command("download <id>")
        .description("Download raw file content")
        .requiredOption("-o, --output <path>", "Output path")
        .action(async (id, opts) => {
        try {
            const body = await getClient().downloadFileContent(id);
            const resolved = path.resolve(opts.output);
            fs.writeFileSync(resolved, body);
            console.log(resolved);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    files
        .command("delete <id>")
        .description("Delete a file")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            printResult(await getClient().deleteFile(id), opts.json);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=files.js.map