"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthCommands = registerAuthCommands;
const child_process_1 = require("child_process");
const client_1 = require("../client");
const config_1 = require("../config");
function openBrowser(url) {
    const platform = process.platform;
    let cmd;
    if (platform === "darwin") {
        cmd = `open "${url}"`;
    }
    else if (platform === "win32") {
        cmd = `start "" "${url}"`;
    }
    else {
        cmd = `xdg-open "${url}"`;
    }
    (0, child_process_1.exec)(cmd, (err) => {
        if (err) {
            console.log(`Could not open browser automatically. Please visit:\n  ${url}`);
        }
    });
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function registerAuthCommands(program) {
    const auth = program.command("auth").description("Authenticate with Tuning Engines");
    auth
        .command("login")
        .description("Authenticate via browser (sign up or log in)")
        .action(async () => {
        try {
            const config = (0, config_1.loadConfig)();
            if (config.api_key) {
                console.log("You are already authenticated. Run `te auth logout` first to re-authenticate.");
                process.exit(0);
            }
            const apiUrl = (0, config_1.getApiUrl)();
            console.log("Starting authentication...\n");
            const session = await client_1.TuningEnginesClient.createDeviceSession(apiUrl);
            console.log(`Your device code: ${session.device_code}\n`);
            console.log("Opening browser to complete authentication...");
            console.log(`If the browser doesn't open, visit:\n  ${session.verification_url}\n`);
            openBrowser(session.verification_url);
            console.log("Waiting for authorization... (press Ctrl+C to cancel)\n");
            const pollInterval = (session.poll_interval || 5) * 1000;
            const expiresAt = Date.now() + (session.expires_in || 600) * 1000;
            while (Date.now() < expiresAt) {
                await sleep(pollInterval);
                try {
                    const result = await client_1.TuningEnginesClient.pollDeviceSession(apiUrl, session.device_code);
                    if (result.status === "complete" && result.api_token) {
                        (0, config_1.saveConfig)({ api_key: result.api_token });
                        console.log("Authenticated successfully!");
                        // Fetch account info to show who we're logged in as
                        try {
                            const client = new client_1.TuningEnginesClient({
                                apiKey: result.api_token,
                                apiUrl,
                            });
                            const account = await client.getAccount();
                            console.log(`Logged in as: ${account.email}`);
                        }
                        catch {
                            // Non-critical — token is saved
                        }
                        console.log("\nAPI token saved to ~/.tuningengines/config.json");
                        return;
                    }
                    if (result.status === "expired") {
                        console.error("Session expired. Please run `te auth login` again.");
                        process.exit(1);
                    }
                    if (result.status === "consumed") {
                        console.error("This session has already been used. Please run `te auth login` again.");
                        process.exit(1);
                    }
                    // status === "pending" — keep polling
                }
                catch (err) {
                    // 429 or transient errors — keep polling
                    if (!err.message?.includes("429")) {
                        // Log non-rate-limit errors but keep trying
                    }
                }
            }
            console.error("Authentication timed out. Please run `te auth login` again.");
            process.exit(1);
        }
        catch (err) {
            console.error(`Authentication failed: ${err.message}`);
            process.exit(1);
        }
    });
    auth
        .command("logout")
        .description("Clear saved authentication token")
        .action(() => {
        (0, config_1.clearApiKey)();
        console.log("Logged out. API token cleared.");
    });
    auth
        .command("status")
        .description("Show current authentication status")
        .action(async () => {
        try {
            const config = (0, config_1.loadConfig)();
            if (!config.api_key) {
                console.log("Not authenticated.");
                console.log("Run `te auth login` to authenticate.");
                return;
            }
            const apiUrl = (0, config_1.getApiUrl)();
            const client = new client_1.TuningEnginesClient({
                apiKey: config.api_key,
                apiUrl,
            });
            const account = await client.getAccount();
            console.log(`Authenticated as: ${account.email}`);
            if (account.tenant) {
                console.log(`Organization:     ${account.tenant}`);
            }
            if (account.balance_cents !== undefined) {
                const credits = account.balance_cents;
                console.log(`Balance:          ${credits.toLocaleString()} Credits ($${(credits / 100).toFixed(2)})`);
            }
        }
        catch (err) {
            if (err.message?.includes("401") || err.message?.includes("403")) {
                console.log("Token is invalid or expired.");
                console.log("Run `te auth login` to re-authenticate.");
            }
            else {
                console.error(`Error checking status: ${err.message}`);
            }
            process.exit(1);
        }
    });
}
//# sourceMappingURL=auth.js.map