# Tuning Engines for DeepSeek Harness

Native DeepSeek Harness telemetry and tool governance for Tuning Engines. The
plugin observes the Harness session event log, preserves turn/step/tool-call
identity, and exports metadata-only traces through a durable local spool.

## Install

```bash
export TE_API_KEY="your-tenant-token-or-inference-key"
dsh plugin --profile default add tuningengines-dsh-plugin
dsh --profile default
```

## Configuration

| Environment variable | Default | Purpose |
|---|---:|---|
| `TE_API_KEY` | required | Tenant API token; `TE_INFERENCE_KEY` is also accepted |
| `TE_API_URL` | `https://app.tuningengines.com` | TE control-plane URL |
| `TE_GOVERNANCE_MODE` | `observe` | `off`, `observe`, or fail-closed `enforce` |
| `TE_TRACE_FLUSH_INTERVAL_MS` | `2000` | Background flush interval |
| `TE_TRACE_BATCH_SIZE` | `64` | Maximum locally spooled records per flush |
| `TE_TRACE_SPOOL_PATH` | `~/.tuningengines/dsh-trace-spool.jsonl` | Durable queue path |

## Data handling

The default and only v1 capture mode is metadata-only. Raw prompts, assistant
content, tool arguments, tool results, credentials, and model reasoning are not
exported. Tool arguments are represented by a SHA-256 fingerprint for stable
correlation without content disclosure.

DeepSeek Harness remains the execution runtime. Tuning Engines supplies the
governance, approvals, trace analytics, cost attribution, and review surfaces.
