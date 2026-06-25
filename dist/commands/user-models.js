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
exports.registerUserModelCommands = registerUserModelCommands;
const output = __importStar(require("../output"));
function registerUserModelCommands(program, getClient) {
    const models = program
        .command("user-models")
        .description("Manage trained and imported models");
    models.command("list")
        .description("List your models")
        .option("--limit <n>", "Max results", "20")
        .option("--offset <n>", "Offset for pagination", "0")
        .action(async (opts) => {
        try {
            output.json(await getClient().listUserModels({
                limit: parseInt(opts.limit),
                offset: parseInt(opts.offset),
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    models.command("show <id>")
        .description("Show model details")
        .action(async (id) => {
        try {
            output.json(await getClient().getUserModel(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    models.command("status <id>")
        .description("Check model readiness status")
        .action(async (id) => {
        try {
            output.json(await getClient().getUserModelStatus(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    models.command("import")
        .description("Import a model from cloud storage")
        .requiredOption("--name <name>", "Model name")
        .requiredOption("--path <path>", "Storage path or URL")
        .option("--source-type <type>", "Source type (manual, trained)", "manual")
        .action(async (opts) => {
        try {
            output.json(await getClient().importUserModel({
                name: opts.name,
                modal_path: opts.path,
                source_type: opts.sourceType,
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    models.command("export <id>")
        .description("Export a model to S3")
        .option("--bucket <bucket>", "S3 bucket name")
        .option("--prefix <prefix>", "S3 key prefix")
        .action(async (id, opts) => {
        try {
            output.json(await getClient().exportUserModel(id, {
                s3_bucket: opts.bucket,
                s3_prefix: opts.prefix,
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    models.command("delete <id>")
        .description("Delete a model from cloud storage")
        .action(async (id) => {
        try {
            output.json(await getClient().deleteUserModel(id));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=user-models.js.map