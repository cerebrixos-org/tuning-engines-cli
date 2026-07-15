from tuning_agents.temporal import tuning_temporal_activity_names
from tuning_agents.temporal_react_streams import (
    ReactStreamEvent,
    TemporalReactRunInput,
    TuningReactStreamsWorkflow,
    TuningReactWorkflow,
    TuningEnginesTemporalReactStreamsFeatures,
    TuningEnginesTemporalReactStreamsPluginConfig,
    define_temporal_react_streams_workflow,
    tuning_temporal_react_streams_activity_names,
    tuning_temporal_react_streams_activities_for,
)


def test_react_streams_plugin_has_separate_name_and_surface():
    config = TuningEnginesTemporalReactStreamsPluginConfig()

    assert config.name == "io.tuningengines.temporal.react_streams"
    assert "react_agent_activity" in tuning_temporal_react_streams_activity_names()
    assert "react_agent_activity" not in tuning_temporal_activity_names()


def test_react_streams_feature_flags_scope_activities():
    features = TuningEnginesTemporalReactStreamsFeatures(
        react_agent=True,
        workflow_streams=True,
        traces=False,
        state_references=False,
    )

    assert tuning_temporal_react_streams_activity_names(features) == ["react_agent_activity"]


def test_react_stream_input_carries_langgraph_parity_context():
    request = TemporalReactRunInput(
        api_key="sk-te-test",
        model="test-model",
        messages=[{"role": "user", "content": "hello"}],
        prompt="Use the same ReAct behavior as LangGraph.",
        run_id="run_test",
        request_id="req_test",
        thread_id="thread_test",
        server_names=["github"],
        tool_names=["search"],
        agent_names=["support-agent"],
        metadata={"source": "unit"},
    )

    assert request.thread_id == "thread_test"
    assert request.server_names == ["github"]
    assert request.agent_names == ["support-agent"]
    assert request.metadata["source"] == "unit"


def test_react_stream_event_is_small_and_serializable():
    event = ReactStreamEvent(
        type="react.agent.started",
        run_id="run_test",
        request_id="req_test",
        status="running",
        metadata={"model": "test-model"},
    )

    assert event.type == "react.agent.started"
    assert event.metadata["model"] == "test-model"


def test_react_workflows_are_module_scoped():
    streamed = define_temporal_react_streams_workflow()
    plain = define_temporal_react_streams_workflow(workflow_streams=False)

    assert streamed is TuningReactStreamsWorkflow
    assert plain is TuningReactWorkflow
    assert "<locals>" not in streamed.__qualname__
    assert "<locals>" not in plain.__qualname__


def test_react_stream_input_allows_worker_env_key():
    request = TemporalReactRunInput(model="test-model")

    assert request.api_key is None


def test_react_streams_feature_flag_selects_plain_workflow():
    assert define_temporal_react_streams_workflow(workflow_streams=False) is TuningReactWorkflow


def test_react_streams_combined_activities_are_deduped():
    features = TuningEnginesTemporalReactStreamsFeatures(
        react_agent=True,
        workflow_streams=True,
        traces=True,
        state_references=True,
    )

    names = [activity.__name__ for activity in tuning_temporal_react_streams_activities_for(features)]

    assert len(names) == len(set(names))
