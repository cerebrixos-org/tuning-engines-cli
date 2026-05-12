from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from .client import TuningClient


@dataclass
class AgentRunInput:
    api_key: str
    inference_url: str = "https://api.tuningengines.com/v1"
    api_url: str = "https://app.tuningengines.com"
    model: str = "auto"
    messages: list[dict[str, Any]] = field(default_factory=list)
    tools: list[dict[str, Any]] | None = None
    max_steps: int = 8


@dataclass
class AgentRunResult:
    output: Any
    trace: dict[str, Any]


async def chat_completion_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    response = client.chat(
        model=payload["model"],
        messages=payload["messages"],
        tools=payload.get("tools"),
        tool_choice=payload.get("tool_choice", "auto") if payload.get("tools") else None,
    )
    return response.model_dump(mode="json") if hasattr(response, "model_dump") else response


async def mcp_tool_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    result = await client.acall_mcp_tool(
        server_name=payload["server_name"],
        tool_name=payload["tool_name"],
        arguments=payload.get("arguments") or {},
    )
    return {"result": result, "trace": client.trace.as_dict()}


async def agent_message_activity(payload: dict[str, Any]) -> dict[str, Any]:
    client = _client_from_payload(payload)
    result = await client.acall_agent(
        agent_name=payload["agent_name"],
        message=payload["message"],
        context=payload.get("context") or {},
    )
    return {"result": result, "trace": client.trace.as_dict()}


def define_temporal_workflow() -> type[Any]:
    """Return a Temporal workflow class without importing Temporal at module load.

    Temporal workflow modules are replayed under deterministic constraints. This
    factory keeps optional dependencies isolated for users who only need
    LangGraph.
    """

    try:
        from temporalio import workflow
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise ImportError("Install tuning-agents[temporal] to use the Temporal adapter") from exc

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

    return TuningAgentWorkflow


def _client_from_payload(payload: dict[str, Any]) -> TuningClient:
    return TuningClient(
        api_key=payload["api_key"],
        api_url=payload.get("api_url", "https://app.tuningengines.com"),
        inference_url=payload.get("inference_url", "https://api.tuningengines.com/v1"),
    )


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
