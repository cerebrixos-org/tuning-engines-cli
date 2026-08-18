import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock

import tuning_agents.langgraph as adapter


def test_create_agent_forwards_approval(monkeypatch):
    captured = {}
    openai_module = ModuleType("langchain_openai")
    prebuilt_module = ModuleType("langgraph.prebuilt")
    langgraph_module = ModuleType("langgraph")

    class ChatOpenAI:
        def __init__(self, **kwargs):
            captured["llm"] = kwargs

    def create_react_agent(llm, tools, **kwargs):
        captured["agent"] = (llm, tools, kwargs)
        return "agent"

    openai_module.ChatOpenAI = ChatOpenAI
    prebuilt_module.create_react_agent = create_react_agent
    langgraph_module.prebuilt = prebuilt_module
    monkeypatch.setitem(sys.modules, "langchain_openai", openai_module)
    monkeypatch.setitem(sys.modules, "langgraph", langgraph_module)
    monkeypatch.setitem(sys.modules, "langgraph.prebuilt", prebuilt_module)

    mcp_tools = Mock(return_value=[])
    agent_tools = Mock(return_value=[])
    monkeypatch.setattr(adapter, "make_langchain_tools", mcp_tools)
    monkeypatch.setattr(adapter, "make_agent_langchain_tools", agent_tools)
    trace = Mock()
    trace.start.return_value = "span"
    client = SimpleNamespace(
        api_key="sk-test",
        inference_url="https://example.test/v1",
        timeout=30,
        trace=trace,
    )

    result = adapter.create_tuning_langgraph_agent(
        client,
        agent_names=["support"],
        approval_id="apr_test",
    )

    assert result == "agent"
    assert captured["llm"]["default_headers"] == {"X-TE-Approval-ID": "apr_test"}
    assert mcp_tools.call_args.kwargs["approval_id"] == "apr_test"
    assert agent_tools.call_args.kwargs["approval_id"] == "apr_test"
