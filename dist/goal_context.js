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
exports.sourceSessionHash = sourceSessionHash;
exports.loadGoalContext = loadGoalContext;
exports.saveGoalContext = saveGoalContext;
exports.clearGoalContext = clearGoalContext;
exports.goalMetadata = goalMetadata;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const SESSION_DIR = path.join(os.homedir(), ".tuningengines", "sessions");
function sha(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}
function resolvedProjectDir(projectDir) {
    return path.resolve(projectDir || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}
function contextPath(projectDir) {
    return path.join(SESSION_DIR, `${sha(resolvedProjectDir(projectDir))}.json`);
}
function sourceSessionHash(projectDir) {
    return sha(resolvedProjectDir(projectDir));
}
function loadGoalContext(projectDir) {
    const file = contextPath(projectDir);
    if (!fs.existsSync(file))
        return undefined;
    try {
        const context = JSON.parse(fs.readFileSync(file, "utf-8"));
        return context?.outcome_context_id || context?.work_item_id ? context : undefined;
    }
    catch {
        return undefined;
    }
}
function saveGoalContext(context) {
    fs.mkdirSync(SESSION_DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(contextPath(context.project_dir), JSON.stringify(context, null, 2) + "\n", { mode: 0o600 });
}
function clearGoalContext(projectDir) {
    const file = contextPath(projectDir);
    if (fs.existsSync(file))
        fs.unlinkSync(file);
}
function goalMetadata(projectDir, fallbackSessionId) {
    const context = loadGoalContext(projectDir);
    if (!context)
        return { te_source_session_hash: sha(fallbackSessionId || resolvedProjectDir(projectDir)) };
    return {
        ...(context.work_item_id ? { te_work_item_id: context.work_item_id, work_item_id: context.work_item_id } : {}),
        outcome_context_id: context.outcome_context_id || "",
        outcome_key: context.outcome_key || context.goal_key || "",
        goal_text: context.title,
        goal_key: context.outcome_key || context.goal_key || "",
    };
}
//# sourceMappingURL=goal_context.js.map