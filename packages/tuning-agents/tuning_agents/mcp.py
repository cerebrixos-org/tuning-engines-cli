from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, Field, create_model

if TYPE_CHECKING:
    from .client import TuningClient


def normalize_mcp_tools(payload: Any) -> list[dict[str, Any]]:
    """Normalize common MCP tool-list response shapes.

    The proxy may return `{"tools": [...]}` or group tools by server. This
    function keeps the adapter tolerant while preserving server attribution.
    """

    if isinstance(payload, dict) and isinstance(payload.get("tools"), list):
        return [dict(tool) for tool in payload["tools"]]
    if isinstance(payload, list):
        return [dict(tool) for tool in payload]

    tools: list[dict[str, Any]] = []
    if isinstance(payload, dict):
        for server in payload.get("servers", []) or []:
            server_name = server.get("name") or server.get("server_name")
            for tool in server.get("tools", []) or []:
                merged = dict(tool)
                merged.setdefault("server_name", server_name)
                tools.append(merged)
    return tools


def pydantic_model_from_json_schema(name: str, schema: Mapping[str, Any] | None) -> type[BaseModel]:
    properties = dict((schema or {}).get("properties") or {})
    required = set((schema or {}).get("required") or [])
    fields: dict[str, tuple[Any, Any]] = {}

    for field_name, spec in properties.items():
        spec = spec or {}
        annotation = _json_type_to_python(spec.get("type"))
        default = ... if field_name in required else None
        fields[field_name] = (
            annotation,
            Field(default, description=spec.get("description")),
        )

    if not fields:
        fields["arguments"] = (
            dict[str, Any],
            Field(default_factory=dict, description="Tool arguments as a JSON object."),
        )

    return create_model(name, **fields)


def make_langchain_tools(
    client: TuningClient,
    *,
    server_names: set[str] | None = None,
    tool_names: set[str] | None = None,
) -> list[Any]:
    try:
        from langchain_core.tools import StructuredTool
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise ImportError("Install tuning-agents[langgraph] to build LangGraph tools") from exc

    raw_tools = normalize_mcp_tools(client.list_mcp_tools())
    tools: list[Any] = []
    for raw in raw_tools:
        server_name = raw.get("server_name") or raw.get("server") or raw.get("mcp_server")
        tool_name = raw.get("name") or raw.get("tool_name")
        if not server_name or not tool_name:
            continue
        if server_names and server_name not in server_names:
            continue
        if tool_names and tool_name not in tool_names:
            continue

        args_schema = pydantic_model_from_json_schema(
            f"{_safe_identifier(server_name)}_{_safe_identifier(tool_name)}_Args",
            raw.get("inputSchema") or raw.get("input_schema") or raw.get("schema"),
        )

        def _call(_server_name: str = server_name, _tool_name: str = tool_name, **kwargs: Any) -> Any:
            if "arguments" in kwargs and len(kwargs) == 1 and isinstance(kwargs["arguments"], dict):
                kwargs = kwargs["arguments"]
            return client.call_mcp_tool(
                server_name=_server_name,
                tool_name=_tool_name,
                arguments=kwargs,
            )

        tools.append(
            StructuredTool.from_function(
                func=_call,
                name=f"{_safe_identifier(server_name)}__{_safe_identifier(tool_name)}",
                description=raw.get("description") or f"Call {tool_name} on MCP server {server_name}.",
                args_schema=args_schema,
            )
        )

    return tools


def make_agent_langchain_tools(
    client: "TuningClient",
    *,
    agent_names: list[str] | set[str],
    descriptions: Mapping[str, str] | None = None,
) -> list[Any]:
    try:
        from langchain_core.tools import StructuredTool
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise ImportError("Install tuning-agents[langgraph] to build LangGraph tools") from exc

    class AgentArgs(BaseModel):
        message: str = Field(..., description="Task or message to send to the registered agent.")
        context: dict[str, Any] = Field(default_factory=dict, description="Optional structured context.")

    tools: list[Any] = []
    for agent_name in agent_names:
        safe_name = _safe_identifier(agent_name)

        def _call(message: str, context: dict[str, Any] | None = None, _agent_name: str = agent_name) -> Any:
            return client.call_agent(agent_name=_agent_name, message=message, context=context or {})

        tools.append(
            StructuredTool.from_function(
                func=_call,
                name=f"agent__{safe_name}",
                description=(descriptions or {}).get(agent_name) or f"Delegate a full task to agent {agent_name}.",
                args_schema=AgentArgs,
            )
        )
    return tools


def skill_tool_spec(
    name: str,
    *,
    description: str | None = None,
    parameters: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Build an OpenAI tool spec for a registered skill.

    Skills are enforced by the proxy orchestrator when their function name
    matches the registered tenant/platform skill name. Unlike MCP and A2A
    agents, this SDK does not invent a local execution endpoint for skills.
    """

    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description or f"Invoke the governed skill {name}.",
            "parameters": parameters
            or {
                "type": "object",
                "properties": {
                    "input": {"type": "string", "description": "Input for the skill."},
                    "context": {"type": "object", "description": "Optional structured context."},
                },
                "required": ["input"],
            },
        },
    }


def agent_tool_spec(
    name: str,
    *,
    description: str | None = None,
) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description or f"Delegate a full task to registered agent {name}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Message or task for the agent."},
                    "context": {"type": "object", "description": "Optional structured context."},
                },
                "required": ["message"],
            },
        },
    }


def _json_type_to_python(json_type: Any) -> Any:
    if isinstance(json_type, list):
        json_type = next((item for item in json_type if item != "null"), None)
    return {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list[Any],
        "object": dict[str, Any],
    }.get(json_type, Any)


def _safe_identifier(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() else "_" for ch in value)
    return cleaned.strip("_") or "tool"
