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
exports.loadConfig = loadConfig;
exports.getApiKey = getApiKey;
exports.getApiUrl = getApiUrl;
exports.clearApiKey = clearApiKey;
exports.saveConfig = saveConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const CONFIG_DIR = path.join(os.homedir(), ".tuningengines");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DEFAULT_API_URL = "https://app.tuningengines.com";
function loadConfig() {
    const config = {};
    // File config (lowest priority)
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
            if (data.api_key)
                config.api_key = data.api_key;
            if (data.api_url)
                config.api_url = data.api_url;
        }
        catch {
            // Ignore parse errors
        }
    }
    // Environment variables override file config
    if (process.env.TE_API_KEY)
        config.api_key = process.env.TE_API_KEY;
    if (process.env.TE_API_URL)
        config.api_url = process.env.TE_API_URL;
    return config;
}
function getApiKey() {
    const config = loadConfig();
    if (!config.api_key) {
        console.error("Error: Not authenticated.\n\n" +
            "Log in with:\n" +
            "  te auth login\n\n" +
            "Or set a token manually:\n" +
            "  te config set-token <your-api-key>\n\n" +
            "Or set the TE_API_KEY environment variable.");
        process.exit(1);
    }
    return config.api_key;
}
function getApiUrl() {
    const config = loadConfig();
    return config.api_url || DEFAULT_API_URL;
}
function clearApiKey() {
    if (!fs.existsSync(CONFIG_FILE))
        return;
    let config = {};
    try {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
    catch {
        return;
    }
    delete config.api_key;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", {
        mode: 0o600,
    });
}
function saveConfig(updates) {
    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    // Load existing config
    let config = {};
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
        }
        catch {
            // Start fresh
        }
    }
    // Merge updates
    Object.assign(config, updates);
    // Write with restrictive permissions
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", {
        mode: 0o600,
    });
}
//# sourceMappingURL=config.js.map