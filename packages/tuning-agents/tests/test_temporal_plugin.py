from tuning_agents.temporal import (
    AgentRunInput,
    TuningEnginesTemporalFeatures,
    TuningEnginesTemporalPluginConfig,
    all_tuning_temporal_activities,
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
