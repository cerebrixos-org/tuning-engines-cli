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
exports.registerInitiativeCommands = registerInitiativeCommands;
const output = __importStar(require("../output"));
function registerInitiativeCommands(program, getClient) {
    const init = program
        .command("initiatives")
        .description("Manage strategic initiatives that group work sessions");
    init.command("list")
        .description("List initiatives")
        .option("--limit <n>", "Max results", "20")
        .option("--offset <n>", "Offset for pagination", "0")
        .action(async (opts) => {
        try {
            output.json(await getClient().listInitiatives({
                limit: parseInt(opts.limit),
                offset: parseInt(opts.offset),
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    init.command("show <id>")
        .description("Show initiative details")
        .action(async (id) => {
        try {
            output.json(await getClient().getInitiative(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    init.command("create")
        .description("Create an initiative")
        .requiredOption("--title <title>", "Initiative title")
        .option("--description <desc>", "Initiative description")
        .action(async (opts) => {
        try {
            output.json(await getClient().createInitiative({
                title: opts.title,
                description: opts.description,
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    init.command("update <id>")
        .description("Update an initiative")
        .option("--title <title>", "New title")
        .option("--description <desc>", "New description")
        .option("--status <status>", "Status (active, completed, archived)")
        .action(async (id, opts) => {
        try {
            const params = {};
            if (opts.title)
                params.title = opts.title;
            if (opts.description)
                params.description = opts.description;
            if (opts.status)
                params.status = opts.status;
            output.json(await getClient().updateInitiative(id, params));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=initiatives.js.map