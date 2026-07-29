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
exports.registerSkillCommands = registerSkillCommands;
const inference_request_1 = require("../inference_request");
const output = __importStar(require("../output"));
function registerSkillCommands(program, getClient) {
    const skills = program.command("skills").description("Discover and invoke governed skills");
    skills.command("list")
        .description("List skills available to the current inference identity")
        .option("--key <key>", "Inference key; defaults to TE_INFERENCE_KEY or a short-lived JWT")
        .option("--base-url <url>", "Inference base URL; defaults to TE_INFERENCE_URL")
        .action(async (opts) => {
        try {
            const bearer = await (0, inference_request_1.resolveInferenceBearer)(getClient(), opts.key);
            output.json(await (0, inference_request_1.callInference)("/skills", undefined, bearer, {
                baseUrl: opts.baseUrl,
                method: "GET",
            }));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    for (const action of ["prepare", "invoke"]) {
        skills.command(`${action} <name>`)
            .description(`${action === "prepare" ? "Prepare" : "Invoke"} a governed skill`)
            .requiredOption("--data <json>", "Skill request JSON")
            .option("--key <key>", "Inference key; defaults to TE_INFERENCE_KEY or a short-lived JWT")
            .option("--base-url <url>", "Inference base URL; defaults to TE_INFERENCE_URL")
            .action(async (name, opts) => {
            try {
                const bearer = await (0, inference_request_1.resolveInferenceBearer)(getClient(), opts.key);
                output.json(await (0, inference_request_1.callInference)(`/skills/${encodeURIComponent(name)}/${action}`, (0, inference_request_1.parseJsonObject)(opts.data), bearer, { baseUrl: opts.baseUrl }));
            }
            catch (err) {
                console.error(err.message);
                process.exit(1);
            }
        });
    }
}
//# sourceMappingURL=skills.js.map