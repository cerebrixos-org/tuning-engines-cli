from tuning_agents.mcp import agent_tool_spec, normalize_mcp_tools, pydantic_model_from_json_schema, skill_tool_spec


def test_normalize_flat_tools():
    tools = normalize_mcp_tools({"tools": [{"name": "x", "server_name": "s"}]})

    assert tools == [{"name": "x", "server_name": "s"}]


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
