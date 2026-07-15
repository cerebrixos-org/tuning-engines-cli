from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import timedelta
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from .client import TuningClient

try:
    from temporalio import workflow
except ImportError:  # pragma: no cover - temporal is an optional extra
    class _WorkflowShim:
        def defn(self, cls: type[Any]) -> type[Any]:
            return cls

        def run(self, fn: Callable[..., Any]) -> Callable[..., Any]:
            return fn

    workflow = _WorkflowShim()


@dataclass
class AgentRunInput:
    api_key: str | None = None
    inference_url: str = "https://api.tuningengines.com/v1"
    api_url: str = "https://app.tuningengines.com"
    model: str = "auto"
    messages: list[dict[str, Any]] = field(default_factory=list)
    tools: list[dict[str, Any]] | None = None
    max_steps: int = 8
    run_id: str | None = None
    request_id: str | None = None
    approval_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentRunResult:
    output: Any
    trace: dict[str, Any]


@dataclass(frozen=True, slots=True)
class TuningEnginesTemporalFeatures:
    """Feature flags for the Tuning Engines Temporal plugin.

    The default enables the governed AI features most teams expect. Set flags
    to false for narrowly scoped workers or when a deployment wants to separate
    model execution, tool execution, and control-plane activities.
    """

    model_calls: bool = True
    skill_tools: bool = True
    mcp_tools: bool = True
    agents: bool = True
    traces: bool = True
    state_references: bool = True
    interventions: bool = True
    approvals: bool = True
    model_catalog: bool = True
    usage: bool = True
    built_in_workflow: bool = True


@dataclass(frozen=True, slots=True)
class TuningEnginesTemporalPluginConfig:
    name: str = "io.tuningengines.temporal"
    features: TuningEnginesTemporalFeatures = field(default_factory=TuningEnginesTemporalFeatures)


def _activity_defn(fn: Callable[..., Any]) -> Callable[..., Any]:
    try:
        from temporalio import activity
    except ImportError:  # pragma: no cover - temporal is an optional extra
        return fn
    return activity.defn(fn)


@_activity_defn
async def chat_completion_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    metadata = _metadata_from_payload(payload, event_type="model.call", client=client)
    response = client.chat(
        model=payload.get("model") or os.getenv("TE_MODEL", "auto"),
        messages=payload["messages"],
        tools=payload.get("tools"),
        tool_choice=payload.get("tool_choice", "auto") if payload.get("tools") else None,
        approval_id=payload.get("approval_id"),
        metadata=metadata,
    )
    return response.model_dump(mode="json") if hasattr(response, "model_dump") else response


@_activity_defn
async def mcp_tool_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    result = await client.acall_mcp_tool(
        server_name=payload["server_name"],
        tool_name=payload["tool_name"],
        arguments=payload.get("arguments") or {},
        approval_id=payload.get("approval_id"),
    )
    return {"result": result, "trace": client.trace.as_dict()}


@_activity_defn
async def agent_message_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    result = await client.acall_agent(
        agent_name=payload["agent_name"],
        message=payload["message"],
        context=payload.get("context") or {},
        approval_id=payload.get("approval_id"),
    )
    return {"result": result, "trace": client.trace.as_dict()}


@_activity_defn
async def list_models_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    return client.list_models()


@_activity_defn
async def list_usage_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    return client.list_usage(model=payload.get("model"), limit=payload.get("limit"))


@_activity_defn
async def record_state_reference_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    reference = dict(payload.get("reference") or {})
    reference.setdefault("runtime", "temporal")
    reference.setdefault("run_id", client.trace.run_id)
    if payload.get("request_id"):
        reference.setdefault("request_id", payload["request_id"])
    return client.upsert_state_reference(reference)


@_activity_defn
async def flush_trace_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    trace = payload.get("trace") or client.trace.as_dict()
    return client.request(
        "POST",
        "/api/v1/traces",
        json={
            "run_id": trace.get("run_id") or client.trace.run_id,
            "name": payload.get("name"),
            "runtime": "temporal",
            "status": payload.get("status") or "running",
            "metadata": dict(payload.get("metadata") or {}),
            "events": trace.get("events") or [],
        },
        trace_type="control",
    )


@_activity_defn
async def list_interventions_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    return client.list_interventions(
        run_id=payload.get("run_id") or client.trace.run_id,
        status=payload.get("status"),
        kind=payload.get("kind"),
    )


@_activity_defn
async def ack_intervention_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    return client.ack_intervention(payload["intervention_id"], metadata=payload.get("metadata") or {})


@_activity_defn
async def complete_intervention_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    return client.complete_intervention(payload["intervention_id"], metadata=payload.get("metadata") or {})


@_activity_defn
async def fail_intervention_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    return client.fail_intervention(payload["intervention_id"], metadata=payload.get("metadata") or {})


def tuning_temporal_activities() -> list[Callable[..., Any]]:
    """Activities provided by the Tuning Engines Temporal plugin."""
    return tuning_temporal_activities_for(TuningEnginesTemporalFeatures())


def tuning_temporal_activities_for(
    features: TuningEnginesTemporalFeatures,
) -> list[Callable[..., Any]]:
    activities: list[Callable[..., Any]] = []
    if features.model_calls or features.skill_tools or features.approvals:
        activities.append(chat_completion_activity)
    if features.model_catalog:
        activities.append(list_models_activity)
    if features.usage:
        activities.append(list_usage_activity)
    if features.mcp_tools:
        activities.append(mcp_tool_activity)
    if features.agents:
        activities.append(agent_message_activity)
    if features.state_references:
        activities.append(record_state_reference_activity)
    if features.traces:
        activities.append(flush_trace_activity)
    if features.interventions:
        activities.extend(
            [
                list_interventions_activity,
                ack_intervention_activity,
                complete_intervention_activity,
                fail_intervention_activity,
            ]
        )
    return activities


def tuning_temporal_activity_names(
    features: TuningEnginesTemporalFeatures | None = None,
) -> list[str]:
    selected = features or TuningEnginesTemporalFeatures()
    return [activity.__name__ for activity in tuning_temporal_activities_for(selected)]


def all_tuning_temporal_activities() -> list[Callable[..., Any]]:
    """All available activities, independent of feature flags.

    Useful for tests and for workers that want manual activity registration
    while still importing from a single SDK location.
    """
    return [
        chat_completion_activity,
        list_models_activity,
        list_usage_activity,
        mcp_tool_activity,
        agent_message_activity,
        record_state_reference_activity,
        flush_trace_activity,
        list_interventions_activity,
        ack_intervention_activity,
        complete_intervention_activity,
        fail_intervention_activity,
    ]


def create_tuning_engines_plugin(
    *,
    name: str = "io.tuningengines.temporal",
    features: TuningEnginesTemporalFeatures | None = None,
    config: TuningEnginesTemporalPluginConfig | None = None,
    include_workflow: bool | None = None,
) -> Any:
    """Create a Temporal SimplePlugin for governed AI workflow workers.

    Temporal owns durable execution and replay. The plugin only registers
    side-effecting activities and the optional built-in demo workflow that call
    Tuning Engines for model access, MCP/agent dispatch, approvals, traces, and
    external state references.
    """

    if config is None:
        selected_features = features or TuningEnginesTemporalFeatures(
            built_in_workflow=True if include_workflow is None else include_workflow
        )
        config = TuningEnginesTemporalPluginConfig(name=name, features=selected_features)
    elif include_workflow is not None:
        config = TuningEnginesTemporalPluginConfig(
            name=config.name,
            features=TuningEnginesTemporalFeatures(
                model_calls=config.features.model_calls,
                skill_tools=config.features.skill_tools,
                mcp_tools=config.features.mcp_tools,
                agents=config.features.agents,
                traces=config.features.traces,
                state_references=config.features.state_references,
                interventions=config.features.interventions,
                approvals=config.features.approvals,
                model_catalog=config.features.model_catalog,
                usage=config.features.usage,
                built_in_workflow=include_workflow,
            ),
        )

    try:
        from temporalio.plugin import SimplePlugin
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise ImportError("Install tuning-agents[temporal] to use the Temporal plugin") from exc

    workflows = [define_temporal_workflow()] if config.features.built_in_workflow else []
    return SimplePlugin(
        config.name,
        activities=tuning_temporal_activities_for(config.features),
        workflows=workflows,
    )


# Friendly alias for partner-program docs and user code.
TuningEnginesPlugin = create_tuning_engines_plugin


@workflow.defn
class TuningAgentWorkflow:
    @workflow.run
    async def run(self, request: AgentRunInput) -> AgentRunResult:
        messages = list(request.messages)
        trace_events: list[dict[str, Any]] = []

        for step in range(request.max_steps):
            llm = await workflow.execute_activity(
                chat_completion_activity,
                {
                    "api_key": request.api_key,
                    "api_url": request.api_url,
                    "inference_url": request.inference_url,
                    "model": request.model,
                    "messages": messages,
                    "tools": request.tools,
                    "run_id": request.run_id,
                    "request_id": request.request_id,
                    "approval_id": request.approval_id,
                    "metadata": request.metadata,
                },
                start_to_close_timeout=timedelta(minutes=5),
            )
            trace_events.extend(_events_from_activity(llm))
            choice = (llm.get("choices") or [{}])[0]
            message = choice.get("message") or {}
            messages.append(message)

            tool_calls = message.get("tool_calls") or []
            if not tool_calls:
                return AgentRunResult(output=message, trace={"events": trace_events})

            for tool_call in tool_calls:
                function = tool_call.get("function") or {}
                tool_call_name = function.get("name") or ""
                arguments = function.get("arguments") or {}
                if isinstance(arguments, str):
                    arguments = json.loads(arguments or "{}")
                if tool_call_name.startswith("agent__"):
                    agent_name = tool_call_name.removeprefix("agent__")
                    tool_result = await workflow.execute_activity(
                        agent_message_activity,
                        {
                            "api_key": request.api_key,
                            "api_url": request.api_url,
                            "inference_url": request.inference_url,
                            "agent_name": agent_name,
                            "message": arguments.get("message") or arguments.get("input") or "",
                            "context": arguments.get("context") or {},
                            "run_id": request.run_id,
                            "request_id": request.request_id,
                            "approval_id": request.approval_id,
                        },
                        start_to_close_timeout=timedelta(minutes=2),
                    )
                else:
                    server_name, tool_name = _split_tool_name(tool_call_name)
                    tool_result = await workflow.execute_activity(
                        mcp_tool_activity,
                        {
                            "api_key": request.api_key,
                            "api_url": request.api_url,
                            "inference_url": request.inference_url,
                            "server_name": server_name,
                            "tool_name": tool_name,
                            "arguments": arguments,
                            "run_id": request.run_id,
                            "request_id": request.request_id,
                            "approval_id": request.approval_id,
                        },
                        start_to_close_timeout=timedelta(minutes=5),
                    )
                trace_events.extend(_events_from_activity(tool_result))
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.get("id"),
                        "content": str(tool_result.get("result")),
                    }
                )

        return AgentRunResult(
            output={"role": "assistant", "content": "Max steps reached."},
            trace={"events": trace_events},
        )


def define_temporal_workflow() -> type[Any]:
    """Return the importable module-scope starter workflow class.

    Kept as a compatibility helper for examples and older imports.
    """
    return TuningAgentWorkflow


def _client_from_payload(payload: dict[str, Any]) -> TuningClient:
    from .client import TuningClient

    client = TuningClient(
        api_key=payload.get("api_key")
        or os.getenv("TE_INFERENCE_KEY")
        or os.getenv("TE_API_KEY"),
        api_url=payload.get("api_url") or os.getenv("TE_API_URL", "https://app.tuningengines.com"),
        inference_url=payload.get("inference_url")
        or os.getenv("TE_INFERENCE_URL", "https://api.tuningengines.com/v1"),
    )
    if payload.get("run_id"):
        client.trace.run_id = str(payload["run_id"])
    return client


def _metadata_from_payload(
    payload: dict[str, Any],
    *,
    event_type: str,
    client: TuningClient,
) -> dict[str, Any]:
    metadata = dict(payload.get("metadata") or {})
    metadata.setdefault("run_id", payload.get("run_id") or client.trace.run_id)
    metadata.setdefault("agent_run_id", metadata["run_id"])
    if payload.get("request_id"):
        metadata.setdefault("request_id", payload["request_id"])
    metadata.setdefault("event_type", event_type)
    return metadata


def _split_tool_name(name: str) -> tuple[str, str]:
    if "__" in name:
        return tuple(name.split("__", 1))  # type: ignore[return-value]
    if "." in name:
        return tuple(name.split(".", 1))  # type: ignore[return-value]
    raise ValueError(f"Tool name must include server and tool, got {name!r}")


def _events_from_activity(payload: Any) -> list[Any]:
    if isinstance(payload, dict):
        trace = payload.get("trace") or {}
        return trace.get("events") or []
    return []
