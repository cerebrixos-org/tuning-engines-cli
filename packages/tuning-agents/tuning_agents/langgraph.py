from __future__ import annotations

from typing import Any

from .client import TuningClient
from .mcp import make_agent_langchain_tools, make_langchain_tools


def create_tuning_langgraph_agent(
    client: TuningClient,
    *,
    model: str = "auto",
    prompt: str | None = None,
    server_names: set[str] | None = None,
    tool_names: set[str] | None = None,
    agent_names: list[str] | set[str] | None = None,
    agent_descriptions: dict[str, str] | None = None,
    checkpointer: Any | None = None,
    interrupt_before: list[str] | None = None,
    **agent_kwargs: Any,
) -> Any:
    """Create a LangGraph ReAct agent backed by Tuning Engines.

    This gives callers a real agent loop while Tuning Engines remains the
    governed gateway for models, MCP tool execution, RBAC, policy, audit,
    request capture, and token economics.
    """

    try:
        from langchain_openai import ChatOpenAI
        from langgraph.prebuilt import create_react_agent
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise ImportError("Install tuning-agents[langgraph] to use the LangGraph adapter") from exc

    llm = ChatOpenAI(
        model=model,
        api_key=client.api_key,
        base_url=client.inference_url,
        timeout=client.timeout,
    )
    tools = make_langchain_tools(client, server_names=server_names, tool_names=tool_names)
    if agent_names:
        tools.extend(
            make_agent_langchain_tools(
                client,
                agent_names=agent_names,
                descriptions=agent_descriptions,
            )
        )

    kwargs: dict[str, Any] = dict(agent_kwargs)
    if checkpointer is not None:
        kwargs["checkpointer"] = checkpointer
    if interrupt_before is not None:
        kwargs["interrupt_before"] = interrupt_before
    if prompt is not None:
        kwargs["prompt"] = prompt

    span_id = client.trace.start(
        "langgraph.agent.create",
        {"model": model, "tools": [getattr(tool, "name", None) for tool in tools]},
    )
    try:
        agent = create_react_agent(llm, tools, **kwargs)
        client.trace.finish(span_id, {"tool_count": len(tools)})
        return agent
    except Exception as exc:
        client.trace.error(span_id, exc)
        raise


def invoke_with_trace(
    client: TuningClient,
    agent: Any,
    messages: list[dict[str, str]],
    *,
    thread_id: str | None = None,
    **config: Any,
) -> Any:
    span_id = client.trace.start("langgraph.agent.invoke", {"thread_id": thread_id})
    try:
        runnable_config = dict(config)
        if thread_id:
            runnable_config.setdefault("configurable", {})["thread_id"] = thread_id
        result = agent.invoke({"messages": messages}, runnable_config or None)
        client.trace.finish(span_id, {"thread_id": thread_id})
        return result
    except Exception as exc:
        client.trace.error(span_id, exc)
        raise


def invoke_and_flush_trace(
    client: TuningClient,
    agent: Any,
    messages: list[dict[str, str]],
    *,
    thread_id: str | None = None,
    name: str | None = None,
    **config: Any,
) -> Any:
    try:
        result = invoke_with_trace(client, agent, messages, thread_id=thread_id, **config)
        client.flush_trace(name=name, runtime="langgraph", status="succeeded", metadata={"thread_id": thread_id})
        return result
    except Exception:
        client.flush_trace(name=name, runtime="langgraph", status="failed", metadata={"thread_id": thread_id})
        raise
