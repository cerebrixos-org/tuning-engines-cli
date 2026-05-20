# Unified API Endpoint

Tuning Engines exposes an OpenAI-compatible inference API. Use it as the
unified endpoint for tools, workers, coding agents, dashboards, and agent
runtimes that already support custom OpenAI-compatible providers.

```text
Base URL: https://api.tuningengines.com/v1
API key:  sk-te-...
Models:   use tenant model IDs from te inference models
```

Requests routed through this endpoint can use Tuning Engines for model RBAC,
routing, fallbacks, guardrails, AGT policy, MCP and agent access checks,
traces, capture, usage metering, and cost attribution.

## Keys

Use the right key for the job:

| Key | Use |
| --- | --- |
| `sk-te-...` | Live inference through `https://api.tuningengines.com/v1` |
| `te_...` | CLI, MCP server, tenant admin automation, and trace upload |

List available models:

```bash
TE_API_URL=https://app.tuningengines.com \
TE_API_KEY=te_your_app_api_key \
te inference models
```

## OpenCode

OpenCode supports custom OpenAI-compatible providers. Add a credential through
`/connect`, choose `Other`, and use `tuning-engines` as the provider ID. Paste
your `sk-te-...` inference key when prompted.

Then add or update `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "tuning-engines": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Tuning Engines",
      "options": {
        "baseURL": "https://api.tuningengines.com/v1"
      },
      "models": {
        "llama-3.3-70b-fp8": {
          "name": "llama-3.3-70b-fp8"
        }
      }
    }
  }
}
```

Replace `llama-3.3-70b-fp8` with a model visible to the inference key. The
provider ID in `/connect` must match the `provider` key in the config. Run
`/models` in OpenCode and select the Tuning Engines model.

## Python OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-te-your-inference-key",
    base_url="https://api.tuningengines.com/v1",
)

response = client.chat.completions.create(
    model="llama-3.3-70b-fp8",
    messages=[
        {"role": "user", "content": "Summarize the current deployment risk."},
    ],
)

print(response.choices[0].message.content)
```

## JavaScript OpenAI SDK

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.TE_INFERENCE_KEY,
  baseURL: "https://api.tuningengines.com/v1",
});

const response = await client.chat.completions.create({
  model: "llama-3.3-70b-fp8",
  messages: [
    { role: "user", content: "Summarize the current deployment risk." },
  ],
});

console.log(response.choices[0].message.content);
```

## Temporal Activities

Temporal should own durable workflow execution. Put nondeterministic model calls
inside Activities, and call Tuning Engines from those Activities.

```python
import os
from openai import OpenAI
from temporalio import activity


client = OpenAI(
    api_key=os.environ["TE_INFERENCE_KEY"],
    base_url=os.environ.get("TE_INFERENCE_BASE", "https://api.tuningengines.com/v1"),
)


@activity.defn
def summarize_ticket(messages: list[dict[str, str]]) -> str:
    response = client.chat.completions.create(
        model=os.environ.get("TE_MODEL", "llama-3.3-70b-fp8"),
        messages=messages,
    )
    return response.choices[0].message.content or ""
```

For governed MCP calls, tenant-agent dispatch, and trace upload from Temporal,
use the packaged runtime adapter:

```bash
pip install "tuning-agents[temporal] @ git+https://github.com/cerebrixos-org/tuning-engines-cli.git#subdirectory=packages/tuning-agents"
```

## LangGraph

LangGraph should own graph execution, state, memory, interrupts, and
checkpointing. For a simple OpenAI-compatible setup, call Tuning Engines from a
graph node with the standard OpenAI client.

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["TE_INFERENCE_KEY"],
    base_url=os.environ.get("TE_INFERENCE_BASE", "https://api.tuningengines.com/v1"),
)


def call_tuning_engines(state: dict) -> dict:
    response = client.chat.completions.create(
        model=os.environ.get("TE_MODEL", "llama-3.3-70b-fp8"),
        messages=state["messages"],
    )
    return {"messages": state["messages"] + [response.choices[0].message.model_dump()]}
```

For governed MCP calls, tenant-agent dispatch, and trace upload from LangGraph,
use the packaged runtime adapter:

```bash
pip install "tuning-agents[langgraph] @ git+https://github.com/cerebrixos-org/tuning-engines-cli.git#subdirectory=packages/tuning-agents"
```

## Other OpenAI-Compatible Clients

For any service that asks for a custom provider, AI gateway, OpenAI-compatible
base URL, or OpenAI API override, use:

```text
Base URL / API base: https://api.tuningengines.com/v1
API key:             sk-te-your-inference-key
Model:               any model allowed by that key
```

For CLI or automation setup, keep the app API URL separate:

```bash
export TE_API_URL=https://app.tuningengines.com
export TE_API_KEY=te_your_app_api_key
export TE_INFERENCE_BASE=https://api.tuningengines.com/v1
export TE_INFERENCE_KEY=sk-te-your-inference-key
```

## Troubleshooting

- A `401` usually means the inference key is missing, expired, or not an
  `sk-te-...` key.
- A `403` usually means the model, MCP server, agent, skill, or tool is not
  allowed by the key, role, guardrail, or AGT policy.
- A provider authentication error can mean Tuning Engines allowed the request
  through but the upstream provider credential or deployment config needs to be
  fixed.
- If a coding agent relies on tool calls, make sure the selected model supports
  OpenAI-style tool calling and that the client sends tool definitions through
  the OpenAI-compatible request shape.
