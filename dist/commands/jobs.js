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
exports.registerJobCommands = registerJobCommands;
const output = __importStar(require("../output"));
function registerJobCommands(program, getClient) {
    const jobs = program.command("jobs").description("Manage training jobs");
    jobs
        .command("list")
        .description("List training jobs")
        .option("-s, --status <status>", "Filter by status (queued, running, succeeded, failed, canceled)")
        .option("-l, --limit <n>", "Max results", "20")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const client = getClient();
            const result = await client.listJobs({
                status: opts.status,
                limit: parseInt(opts.limit),
            });
            const jobs = result.data || [];
            if (opts.json) {
                output.json(jobs);
                return;
            }
            if (jobs.length === 0) {
                console.log("No jobs found.");
                return;
            }
            output.table(["ID", "Status", "Base Model", "Output", "GPU Min", "Cost", "Created"], jobs.map((j) => [
                j.id,
                j.status,
                j.base_model || "-",
                j.output_name || "-",
                String(j.gpu_minutes || 0),
                j.estimated_charges ? output.formatUsdAsCredits(Number(j.estimated_charges)) : "-",
                new Date(j.created_at).toLocaleDateString(),
            ]));
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    jobs
        .command("show <id>")
        .description("Show job details")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const client = getClient();
            const job = await client.getJob(id);
            if (opts.json) {
                output.json(job);
                return;
            }
            output.keyValue([
                ["ID", job.id],
                ["Status", job.status],
                ["Agent", job.agent],
                ["Base Model", job.base_model],
                ["Output Name", job.output_name],
                ["Repo URL", job.repo_url],
                ["Branch", job.branch],
                ["GPU Minutes", job.gpu_minutes],
                ["Est. Charges", job.estimated_charges ? output.formatUsdAsCredits(Number(job.estimated_charges)) : "-"],
                ["Error", job.error_message || "-"],
                ["Retryable", String(job.retryable)],
                ["Created", job.created_at],
                ["Submitted", job.submitted_at || "-"],
            ]);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    jobs
        .command("create")
        .description("Submit a new training job")
        .option("--base-model <model>", "Base model HuggingFace ID (required unless --base-user-model-id is given)")
        .requiredOption("--output-name <name>", "Name for the fine-tuned model")
        .option("--repo-url <url>", "GitHub repository URL")
        .option("--branch <branch>", "Git branch", "main")
        .option("--github-token <token>", "GitHub personal access token")
        .option("--epochs <n>", "Number of training epochs")
        .option("--max-examples <n>", "Maximum training examples")
        .option("--base-user-model-id <id>", "Use a trained model as base")
        .option("--s3-bucket <bucket>", "S3 bucket for export")
        .option("--s3-key <key>", "AWS access key ID")
        .option("--s3-secret <secret>", "AWS secret access key")
        .option("--s3-region <region>", "AWS region")
        .option("--agent <agent>", "Agent type (e.g. code_repo, siera)")
        .option("--quality-tier <tier>", "Quality tier (e.g. standard, high)")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            if (!opts.baseModel && !opts.baseUserModelId) {
                console.error("Error: --base-model is required unless --base-user-model-id is provided");
                process.exit(1);
            }
            const client = getClient();
            const params = {
                output_name: opts.outputName,
            };
            if (opts.baseModel)
                params.base_model = opts.baseModel;
            if (opts.repoUrl)
                params.repo_url = opts.repoUrl;
            if (opts.branch)
                params.branch = opts.branch;
            if (opts.githubToken)
                params.github_token = opts.githubToken;
            if (opts.epochs)
                params.num_epochs = parseInt(opts.epochs);
            if (opts.maxExamples)
                params.max_examples = parseInt(opts.maxExamples);
            if (opts.baseUserModelId)
                params.base_user_model_id = opts.baseUserModelId;
            if (opts.s3Bucket)
                params.s3_output_bucket = opts.s3Bucket;
            if (opts.s3Key)
                params.s3_access_key_id = opts.s3Key;
            if (opts.s3Secret)
                params.s3_secret_access_key = opts.s3Secret;
            if (opts.s3Region)
                params.s3_region = opts.s3Region;
            if (opts.agent)
                params.agent = opts.agent;
            if (opts.qualityTier)
                params.quality_tier = opts.qualityTier;
            const job = await client.createJob(params);
            if (opts.json) {
                output.json(job);
                return;
            }
            console.log(`Job created: ${job.id}`);
            console.log(`Status: ${job.status}`);
            console.log(`Base Model: ${job.base_model}`);
            console.log(`Output: ${job.output_name}`);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    jobs
        .command("cancel <id>")
        .description("Cancel a running job")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const client = getClient();
            const job = await client.cancelJob(id);
            if (opts.json) {
                output.json(job);
                return;
            }
            console.log(`Job ${job.id} canceled.`);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    jobs
        .command("status <id>")
        .description("Get live job status")
        .option("--watch", "Poll continuously until job completes")
        .option("--interval <seconds>", "Poll interval in seconds", "30")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const client = getClient();
            const poll = async () => {
                const status = await client.getJobStatus(id);
                if (opts.json) {
                    output.json(status);
                }
                else {
                    output.keyValue([
                        ["Status", status.status],
                        ["GPU Minutes", status.gpu_minutes],
                        ["Est. Charges", status.estimated_charges ? output.formatUsdAsCredits(Number(status.estimated_charges)) : "-"],
                        ["Balance", output.formatCents(status.balance_cents)],
                        ["Delivery", status.delivery_status || "-"],
                    ]);
                }
                return status;
            };
            const status = await poll();
            if (opts.watch) {
                const terminalStatuses = ["succeeded", "failed", "canceled"];
                if (terminalStatuses.includes(status.status)) {
                    console.log("\nJob is in terminal state.");
                    return;
                }
                const interval = parseInt(opts.interval) * 1000;
                const pollLoop = async () => {
                    await new Promise((r) => setTimeout(r, interval));
                    if (!opts.json)
                        console.log("\n---");
                    const s = await poll();
                    if (!terminalStatuses.includes(s.status)) {
                        await pollLoop();
                    }
                    else {
                        console.log("\nJob completed.");
                    }
                };
                await pollLoop();
            }
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    jobs
        .command("retry <id>")
        .description("Retry a failed job from checkpoint")
        .option("--github-token <token>", "GitHub PAT for private repos (required if original job used one)")
        .option("--json", "Output as JSON")
        .action(async (id, opts) => {
        try {
            const client = getClient();
            // Fetch job details and estimate first
            const jobDetails = await client.getJob(id);
            let estimate = null;
            try {
                estimate = await client.estimateJob({
                    base_model: jobDetails.base_model,
                    num_epochs: jobDetails.num_epochs,
                    max_examples: jobDetails.max_examples,
                    use_case: jobDetails.agent,
                });
            }
            catch {
                // Estimate failed — continue (server validates balance)
            }
            // Show estimate
            if (estimate && estimate.estimate) {
                const est = estimate.estimate;
                const bal = estimate.balance;
                console.log("--- Cost Estimate ---");
                console.log(`Estimated Cost: ${output.formatUsdAsCredits(Number(est.estimated_cost_usd))}`);
                if (est.estimated_time_display) {
                    console.log(`Estimated Time: ${est.estimated_time_display}`);
                }
                if (est.gpu_type) {
                    console.log(`GPU: ${est.gpu_count || 1}x ${est.gpu_type}`);
                }
                console.log(`Balance: ${output.formatCents(bal.current_cents)} (required: ${output.formatCents(bal.required_cents)})`);
                console.log(`Sufficient: ${bal.sufficient ? "Yes" : "No"}`);
                console.log("---------------------");
            }
            const job = await client.retryJob(id, opts.githubToken);
            if (opts.json) {
                output.json({ ...job, retry_estimate: estimate });
                return;
            }
            console.log(`Retry job created: ${job.id}`);
            console.log(`Status: ${job.status}`);
            if (estimate?.estimate?.estimated_cost_usd) {
                console.log(`Accepted Estimate: ${output.formatUsdAsCredits(Number(estimate.estimate.estimated_cost_usd))}`);
            }
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    jobs
        .command("estimate")
        .description("Get a cost estimate for a training job")
        .option("--base-model <model>", "Base model HuggingFace ID (required unless --base-user-model-id is given)")
        .option("--base-user-model-id <id>", "Use a trained model as base (resolves base model automatically)")
        .option("--epochs <n>", "Number of epochs", "3")
        .option("--max-examples <n>", "Maximum examples")
        .option("--repo-size-mb <mb>", "Repository size in MB")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            if (!opts.baseModel && !opts.baseUserModelId) {
                console.error("Error: --base-model is required unless --base-user-model-id is provided");
                process.exit(1);
            }
            const client = getClient();
            const params = {
                num_epochs: parseInt(opts.epochs),
            };
            if (opts.baseModel)
                params.base_model = opts.baseModel;
            if (opts.baseUserModelId)
                params.base_user_model_id = opts.baseUserModelId;
            if (opts.maxExamples)
                params.max_examples = parseInt(opts.maxExamples);
            if (opts.repoSizeMb)
                params.repo_size_mb = parseFloat(opts.repoSizeMb);
            const result = await client.estimateJob(params);
            if (opts.json) {
                output.json(result);
                return;
            }
            const est = result.estimate;
            const bal = result.balance;
            console.log(`Estimated Cost: ${output.formatUsdAsCredits(Number(est.estimated_cost_usd))}`);
            if (est.min_cost_usd && est.max_cost_usd) {
                console.log(`Range: ${output.formatUsdAsCredits(Number(est.min_cost_usd))} - ${output.formatUsdAsCredits(Number(est.max_cost_usd))}`);
            }
            console.log(`Current Balance: ${output.formatCents(bal.current_cents)}`);
            console.log(`Required: ${output.formatCents(bal.required_cents)}`);
            console.log(`Sufficient: ${bal.sufficient ? "Yes" : "No"}`);
        }
        catch (err) {
            console.error(err.message);
            process.exit(1);
        }
    });
    jobs
        .command("validate-s3")
        .description("Validate S3 credentials before submitting a job")
        .requiredOption("--s3-bucket <bucket>", "S3 bucket name")
        .requiredOption("--s3-key <key>", "AWS access key ID")
        .requiredOption("--s3-secret <secret>", "AWS secret access key")
        .requiredOption("--s3-region <region>", "AWS region")
        .option("--json", "Output as JSON")
        .action(async (opts) => {
        try {
            const client = getClient();
            const result = await client.validateS3({
                s3_bucket: opts.s3Bucket,
                s3_access_key_id: opts.s3Key,
                s3_secret_access_key: opts.s3Secret,
                s3_region: opts.s3Region,
            });
            if (opts.json) {
                output.json(result);
                return;
            }
            console.log("S3 credentials validated successfully.");
        }
        catch (err) {
            console.error(`S3 validation failed: ${err.message}`);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=jobs.js.map