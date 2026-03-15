import { Command } from "commander";
import { saveConfig, loadConfig } from "../config";

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage CLI configuration");

  config
    .command("set-token <token>")
    .description("Set your API token (te_...)")
    .action((token: string) => {
      if (!token.startsWith("te_")) {
        console.error("Warning: API tokens usually start with 'te_'");
      }
      saveConfig({ api_key: token });
      console.log("API token saved to ~/.tuningengines/config.json");
    });

  config
    .command("set-url <url>")
    .description("Set the API URL (default: https://app.tuningengines.com)")
    .action((url: string) => {
      saveConfig({ api_url: url });
      console.log(`API URL set to ${url}`);
    });

  config
    .command("show")
    .description("Show current configuration")
    .action(() => {
      const cfg = loadConfig();
      console.log(`API URL:   ${cfg.api_url || "https://app.tuningengines.com (default)"}`);
      if (cfg.api_key) {
        const masked = cfg.api_key.slice(0, 7) + "*".repeat(Math.max(0, cfg.api_key.length - 7));
        console.log(`API Key:   ${masked}`);
      } else {
        console.log("API Key:   (not set)");
      }
      console.log(`\nEnvironment overrides:`);
      console.log(`  TE_API_KEY: ${process.env.TE_API_KEY ? "(set)" : "(not set)"}`);
      console.log(`  TE_API_URL: ${process.env.TE_API_URL || "(not set)"}`);
    });
}
