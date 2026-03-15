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
exports.registerBillingCommands = registerBillingCommands;
const child_process_1 = require("child_process");
const config_1 = require("../config");
const output = __importStar(require("../output"));
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
function registerBillingCommands(program, getClient) {
    const billing = program.command("billing").description("Billing and credits");
    billing
        .command("show")
        .description("Show account balance and recent transactions")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const client = getClient();
            const billing = await client.getBilling();
            if (opts.json) {
                output.json(billing);
                return;
            }
            console.log(`Balance: ${output.formatCents(billing.balance_cents)}`);
            console.log();
            if (billing.auto_topup) {
                const at = billing.auto_topup;
                console.log(`Auto Top-Up: ${at.enabled ? "Enabled" : "Disabled"}`);
                if (at.enabled) {
                    console.log(`  Threshold: ${output.formatCents(at.threshold_cents)}`);
                    console.log(`  Amount: ${output.formatCents(at.amount_cents)}`);
                }
                console.log();
            }
            const txns = billing.transactions || [];
            if (txns.length > 0) {
                console.log("Recent Transactions:");
                output.table(["Date", "Type", "Amount", "Balance After", "Description"], txns.slice(0, 20).map((t) => [
                    new Date(t.created_at).toLocaleDateString(),
                    t.transaction_type || "-",
                    output.formatCents(t.amount_cents),
                    output.formatCents(t.balance_after_cents),
                    t.description || "-",
                ]));
            }
            else {
                console.log("No transactions yet.");
            }
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    billing
        .command("add-credits")
        .description("Open the billing page in your browser to add credits")
        .action(() => {
        const apiUrl = (0, config_1.getApiUrl)();
        const billingUrl = `${apiUrl}/billing`;
        console.log("Opening billing page to add credits...");
        openBrowser(billingUrl);
        console.log(`\nIf the browser didn't open, visit:\n  ${billingUrl}`);
    });
}
//# sourceMappingURL=billing.js.map