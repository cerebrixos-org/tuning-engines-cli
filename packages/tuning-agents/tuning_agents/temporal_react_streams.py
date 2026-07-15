from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Callable

from .temporal import (
    TuningEnginesTemporalFeatures,
    _activity_defn,
    flush_trace_activity,
    record_state_reference_activity,
)


@dataclass
class TemporalReactRunInput:
    """Input for the Temporal ReAct Streams workflow.

    This workflow intentionally delegates ReAct behavior to the LangGraph adapter
    so Temporal and LangGraph users share the same planner/tool semantics.
    Temporal owns durability, retries, signals, history, and live stream output.
    """

    api_key: str
    inference_url: str = "https://api.tuningengines.com/v1"
    api_url: str = "https://app.tuningengines.com"
    model: str = "auto"
    messages: list[dict[str, Any]] = field(default_factory=list)
    prompt: str | None = None
    run_id: str | None = None
    request_id: str | None = None
    thread_id: str | None = None
    server_names: list[str] | None = None
    tool_names: list[str] | None = None
    agent_names: list[str] | None = None
    agent_descriptions: dict[str, str] | None = None
    approval_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class TemporalReactRunResult:
    output: Any
    trace: dict[str, Any]


@dataclass(frozen=True, slots=True)
class ReactStreamEvent:
    type: str
    run_id: str | None = None
    request_id: str | None = None
    step: int | None = None
    status: str | None = None
    message: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class TuningEnginesTemporalReactStreamsFeatures:
    react_agent: bool = True
    workflow_streams: bool = True
    traces: bool = True
    state_references: bool = True


@dataclass(frozen=True, slots=True)
class TuningEnginesTemporalReactStreamsPluginConfig:
    name: str = "io.tuningengines.temporal.react_streams"
    features: TuningEnginesTemporalReactStreamsFeatures = field(
        default_factory=TuningEnginesTemporalReactStreamsFeatures
    )


@_activity_defn
async def react_agent_activity(payload: dict[str, Any]) -> dict[str, Any]:
    await publish_react_stream_event(
        ReactStreamEvent(
            type="react.agent.started",
            run_id=payload.get("run_id"),
            request_id=payload.get("request_id"),
            status="running",
            message="ReAct agent activity started",
            metadata={"model": payload.get("model")},
        )
    )

    from .client import TuningClient
    from .langgraph import create_tuning_langgraph_agent, invoke_with_trace

    client = TuningClient(
        api_key=payload.get("api_key"),
        api_url=payload.get("api_url") or "https://app.tuningengines.com",
        inference_url=payload.get("inference_url") or "https://api.tuningengines.com/v1",
    )
    if payload.get("run_id"):
        client.trace.run_id = str(payload["run_id"])

    agent = create_tuning_langgraph_agent(
        client,
        model=payload.get("model") or "auto",
        prompt=payload.get("prompt"),
        server_names=set(payload.get("server_names") or []),
        tool_names=set(payload.get("tool_names") or []),
        agent_names=payload.get("agent_names") or [],
        agent_descriptions=payload.get("agent_descriptions") or {},
    )

    try:
        result = invoke_with_trace(
            client,
            agent,
            payload.get("messages") or [],
            thread_id=payload.get("thread_id"),
        )
        await publish_react_stream_event(
            ReactStreamEvent(
                type="react.agent.completed",
                run_id=payload.get("run_id"),
                request_id=payload.get("request_id"),
                status="succeeded",
                message="ReAct agent activity completed",
            )
        )
        return {"result": result, "trace": client.trace.as_dict()}
    except Exception as exc:
        await publish_react_stream_event(
            ReactStreamEvent(
                type="react.agent.failed",
                run_id=payload.get("run_id"),
                request_id=payload.get("request_id"),
                status="failed",
                message=str(exc),
            )
        )
        raise


async def publish_react_stream_event(
    event: ReactStreamEvent,
    *,
    topic_name: str = "tuning_events",
    force_flush: bool = True,
) -> None:
    """Publish a live event from inside a Temporal Activity when available.

    The Temporal dependency is optional at import time. Outside a Temporal
    Activity, or on SDK versions without Workflow Streams, this function becomes
    a no-op so tests and non-streaming workers can still use the plugin.
    """

    try:
        from temporalio.contrib.workflow_streams import WorkflowStreamClient
    except ImportError:  # pragma: no cover - depends on optional Temporal preview API
        return

    try:
        stream_client = WorkflowStreamClient.from_within_activity()
        async with stream_client:
            topic = stream_client.topic(topic_name, type=ReactStreamEvent)
            topic.publish(event, force_flush=force_flush)
    except Exception:
        return


def tuning_temporal_react_streams_activities_for(
    features: TuningEnginesTemporalReactStreamsFeatures,
) -> list[Callable[..., Any]]:
    activities: list[Callable[..., Any]] = []
    if features.react_agent:
        activities.append(react_agent_activity)
    if features.traces:
        activities.append(flush_trace_activity)
    if features.state_references:
        activities.append(record_state_reference_activity)
    return activities


def tuning_temporal_react_streams_activity_names(
    features: TuningEnginesTemporalReactStreamsFeatures | None = None,
) -> list[str]:
    selected = features or TuningEnginesTemporalReactStreamsFeatures()
    return [activity.__name__ for activity in tuning_temporal_react_streams_activities_for(selected)]


def create_tuning_engines_react_streams_plugin(
    *,
    config: TuningEnginesTemporalReactStreamsPluginConfig | None = None,
    include_base_activities: bool = False,
    base_features: TuningEnginesTemporalFeatures | None = None,
    include_workflow: bool = True,
) -> Any:
    """Create an opt-in Temporal plugin for ReAct parity plus Workflow Streams."""

    selected = config or TuningEnginesTemporalReactStreamsPluginConfig()
    try:
        from temporalio.plugin import SimplePlugin
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise ImportError("Install tuning-agents[temporal,langgraph] to use this plugin") from exc

    activities = tuning_temporal_react_streams_activities_for(selected.features)
    if include_base_activities:
        from .temporal import tuning_temporal_activities_for

        activities.extend(tuning_temporal_activities_for(base_features or TuningEnginesTemporalFeatures()))

    return SimplePlugin(
        selected.name,
        activities=activities,
        workflows=[define_temporal_react_streams_workflow()] if include_workflow else [],
    )


TuningEnginesReactStreamsPlugin = create_tuning_engines_react_streams_plugin


def define_temporal_react_streams_workflow() -> type[Any]:
    try:
        from temporalio import workflow
        from temporalio.contrib.workflow_streams import WorkflowStream
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise ImportError("Install tuning-agents[temporal,langgraph] to use this workflow") from exc

    @workflow.defn
    class TuningReactStreamsWorkflow:
        @workflow.init
        def __init__(self, request: TemporalReactRunInput) -> None:
            self.stream = WorkflowStream()
            self.events = self.stream.topic("tuning_events", type=ReactStreamEvent)
            self.subscriber_done = False

        @workflow.signal
        async def subscriber_acknowledged_terminator(self) -> None:
            self.subscriber_done = True

        @workflow.run
        async def run(self, request: TemporalReactRunInput) -> TemporalReactRunResult:
            self.events.publish(
                ReactStreamEvent(
                    type="workflow.started",
                    run_id=request.run_id,
                    request_id=request.request_id,
                    status="running",
                    message="Temporal ReAct workflow started",
                    metadata={"thread_id": request.thread_id, **request.metadata},
                )
            )
            try:
                result = await workflow.execute_activity(
                    react_agent_activity,
                    {
                        "api_key": request.api_key,
                        "api_url": request.api_url,
                        "inference_url": request.inference_url,
                        "model": request.model,
                        "messages": request.messages,
                        "prompt": request.prompt,
                        "run_id": request.run_id,
                        "request_id": request.request_id,
                        "thread_id": request.thread_id,
                        "server_names": request.server_names,
                        "tool_names": request.tool_names,
                        "agent_names": request.agent_names,
                        "agent_descriptions": request.agent_descriptions,
                        "approval_id": request.approval_id,
                        "metadata": request.metadata,
                    },
                    start_to_close_timeout=timedelta(minutes=10),
                )
                self.events.publish(
                    ReactStreamEvent(
                        type="workflow.completed",
                        run_id=request.run_id,
                        request_id=request.request_id,
                        status="succeeded",
                        message="Temporal ReAct workflow completed",
                    )
                )
                await self._wait_for_subscriber_ack()
                return TemporalReactRunResult(
                    output=result.get("result"),
                    trace=result.get("trace") or {"events": []},
                )
            except Exception as exc:
                self.events.publish(
                    ReactStreamEvent(
                        type="workflow.failed",
                        run_id=request.run_id,
                        request_id=request.request_id,
                        status="failed",
                        message=str(exc),
                    )
                )
                await self._wait_for_subscriber_ack()
                raise

        async def _wait_for_subscriber_ack(self) -> None:
            try:
                await workflow.wait_condition(
                    lambda: self.subscriber_done,
                    timeout=timedelta(seconds=30),
                )
            except TimeoutError:
                pass

    return TuningReactStreamsWorkflow
