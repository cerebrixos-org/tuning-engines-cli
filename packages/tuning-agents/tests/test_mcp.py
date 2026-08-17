import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock

from tuning_agents.mcp import (
    agent_tool_spec,
    make_agent_langchain_tools,
    make_langchain_tools,
    normalize_mcp_tools,
    pydantic_model_from_json_schema,
    skill_tool_spec,
)


def test_normalize_flat_tools():
    tools = normalize_mcp_tools({"tools": [{"name": "x", "server_name": "s"}]})

    assert tools == [{"name": "x", "server_name": "s"}]


def test_normalize_live_catalog_server_name():
    tools = normalize_mcp_tools({"tools": [{"name": "x", "mcp_server_name": "s"}]})

    assert tools[0]["server_name"] == "s"


def test_normalize_grouped_tools():
    tools = normalize_mcp_tools({"servers": [{"name": "s", "tools": [{"name": "x"}]}]})

    assert tools == [{"name": "x", "server_name": "s"}]


def test_pydantic_model_from_json_schema():
    model = pydantic_model_from_json_schema(
        "Args",
        {
            "type": "object",
            "required": ["query"],
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer"},
            },
        },
    )

    parsed = model(query="hello", limit=3)

    assert parsed.query == "hello"
    assert parsed.limit == 3


def test_agent_and_skill_tool_specs():
    agent = agent_tool_spec("billing-escalation")
    skill = skill_tool_spec("analytics")

    assert agent["function"]["name"] == "billing-escalation"
    assert skill["function"]["name"] == "analytics"


def test_langchain_tools_forward_approval(monkeypatch):
    tools_module = ModuleType("langchain_core.tools")

    class StructuredTool:
        @classmethod
        def from_function(cls, **kwargs):
            return SimpleNamespace(**kwargs)

    tools_module.StructuredTool = StructuredTool
    langchain_core = ModuleType("langchain_core")
    langchain_core.tools = tools_module
    monkeypatch.setitem(sys.modules, "langchain_core", langchain_core)
    monkeypatch.setitem(sys.modules, "langchain_core.tools", tools_module)

    client = Mock()
    client.list_mcp_tools.return_value = {
        "tools": [
            {
                "name": "search",
                "mcp_server_name": "docs",
                "input_schema": {
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"],
                },
            }
        ]
    }

    mcp_tool = make_langchain_tools(client, approval_id="apr_test")[0]
    agent_tool = make_agent_langchain_tools(
        client,
        agent_names=["support"],
        approval_id="apr_test",
    )[0]
    mcp_tool.func(query="hello")
    agent_tool.func(message="help", context={"ticket": 1})

    client.call_mcp_tool.assert_called_once_with(
        server_name="docs",
        tool_name="search",
        arguments={"query": "hello"},
        approval_id="apr_test",
    )
    client.call_agent.assert_called_once_with(
        agent_name="support",
        message="help",
        context={"ticket": 1},
        approval_id="apr_test",
    )
