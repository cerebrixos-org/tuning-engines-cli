from unittest.mock import AsyncMock, Mock

import pytest

import tuning_agents.temporal as temporal_module
from tuning_agents.temporal import (
    AgentRunInput,
    TuningAgentWorkflow,
    TuningEnginesTemporalFeatures,
    TuningEnginesTemporalPluginConfig,
    all_tuning_temporal_activities,
    define_temporal_workflow,
    tuning_temporal_activity_names,
)


def test_temporal_feature_flags_default_to_full_control_plane():
    names = set(tuning_temporal_activity_names())

    assert "chat_completion_activity" in names
    assert "list_models_activity" in names
    assert "list_usage_activity" in names
    assert "mcp_tool_activity" in names
    assert "agent_message_activity" in names
    assert "record_state_reference_activity" in names
    assert "flush_trace_activity" in names
    assert "list_interventions_activity" in names
    assert "ack_intervention_activity" in names
    assert "complete_intervention_activity" in names
    assert "fail_intervention_activity" in names


def test_temporal_feature_flags_can_scope_worker_capabilities():
    features = TuningEnginesTemporalFeatures(
        model_calls=True,
        skill_tools=False,
        mcp_tools=False,
        agents=False,
        traces=False,
        state_references=True,
        interventions=False,
        approvals=False,
        model_catalog=False,
        usage=False,
        built_in_workflow=False,
    )

    assert tuning_temporal_activity_names(features) == [
        "chat_completion_activity",
        "record_state_reference_activity",
    ]


def test_temporal_plugin_config_is_explicit_and_neutral():
    config = TuningEnginesTemporalPluginConfig()

    assert config.name == "io.tuningengines.temporal"
    assert config.features.built_in_workflow is True


def test_all_temporal_activities_exports_every_activity():
    names = [activity.__name__ for activity in all_tuning_temporal_activities()]

    assert len(names) == len(set(names))
    assert set(tuning_temporal_activity_names()).issubset(names)


def test_agent_run_input_carries_trace_and_approval_context():
    request = AgentRunInput(
        api_key="sk-te-test",
        model="test-model",
        run_id="run_test",
        request_id="req_test",
        approval_id="apr_test",
        metadata={"source": "unit"},
    )

    assert request.run_id == "run_test"
    assert request.request_id == "req_test"
    assert request.approval_id == "apr_test"
    assert request.metadata["source"] == "unit"


def test_builtin_workflow_is_module_scoped():
    workflow = define_temporal_workflow()

    assert workflow is TuningAgentWorkflow
    assert "<locals>" not in workflow.__qualname__


def test_agent_run_input_allows_worker_env_key():
    request = AgentRunInput(model="test-model")

    assert request.api_key is None


@pytest.mark.asyncio
async def test_chat_activity_suppresses_model_serializer_warnings(monkeypatch):
    response = Mock()
    response.model_dump.return_value = {"metadata": {"te_tools_present": True}}
    client = Mock()
    client.trace.run_id = "run_test"
    client.chat.return_value = response
    monkeypatch.setattr(temporal_module, "_client_from_payload", lambda payload: client)

    result = await temporal_module.chat_completion_activity({"messages": []})

    assert result == {"metadata": {"te_tools_present": True}}
    response.model_dump.assert_called_once_with(mode="json", warnings=False)


@pytest.mark.asyncio
async def test_builtin_workflow_preserves_raw_mcp_target(monkeypatch):
    name = "Hacker_News_MCP__hn_get_stories"
    execute_activity = AsyncMock(
        side_effect=[
            {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "tool_calls": [
                                {
                                    "id": "call-1",
                                    "function": {"name": name, "arguments": "{}"},
                                }
                            ],
                        }
                    }
                ]
            },
            {"result": [{"title": "Temporal"}]},
            {"choices": [{"message": {"role": "assistant", "content": "Done"}}]},
        ]
    )
    monkeypatch.setattr(temporal_module.workflow, "execute_activity", execute_activity)

    await TuningAgentWorkflow().run(
        AgentRunInput(
            messages=[{"role": "user", "content": "Fetch a story"}],
            tools=[{"type": "function", "function": {"name": name}}],
            mcp_tool_targets={
                name: {
                    "server_name": "Hacker News MCP",
                    "tool_name": "hn_get_stories",
                }
            },
        )
    )

    mcp_payload = execute_activity.call_args_list[1].args[1]
    assert (mcp_payload["server_name"], mcp_payload["tool_name"]) == (
        "Hacker News MCP",
        "hn_get_stories",
    )


def test_mcp_target_mapping_rejects_an_empty_entry():
    with pytest.raises(ValueError, match="requires server_name and tool_name"):
        temporal_module._split_tool_name("server__tool", {"server__tool": {}})
