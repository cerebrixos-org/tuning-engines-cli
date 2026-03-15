import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".tuningengines");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DEFAULT_API_URL = "https://app.tuningengines.com";

export interface Config {
  api_key?: string;
  api_url?: string;
}

export function loadConfig(): Config {
  const config: Config = {};

  // File config (lowest priority)
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      if (data.api_key) config.api_key = data.api_key;
      if (data.api_url) config.api_url = data.api_url;
    } catch {
      // Ignore parse errors
    }
  }

  // Environment variables override file config
  if (process.env.TE_API_KEY) config.api_key = process.env.TE_API_KEY;
  if (process.env.TE_API_URL) config.api_url = process.env.TE_API_URL;

  return config;
}

export function getApiKey(): string {
  const config = loadConfig();
  if (!config.api_key) {
    console.error(
      "Error: Not authenticated.\n\n" +
        "Log in with:\n" +
        "  te auth login\n\n" +
        "Or set a token manually:\n" +
        "  te config set-token <your-api-key>\n\n" +
        "Or set the TE_API_KEY environment variable."
    );
    process.exit(1);
  }
  return config.api_key;
}

export function getApiUrl(): string {
  const config = loadConfig();
  return config.api_url || DEFAULT_API_URL;
}

export function clearApiKey(): void {
  if (!fs.existsSync(CONFIG_FILE)) return;

  let config: Config = {};
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return;
  }

  delete config.api_key;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}

export function saveConfig(updates: Partial<Config>): void {
  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Load existing config
  let config: Config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    } catch {
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
