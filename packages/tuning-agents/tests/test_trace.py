from tuning_agents.trace import TraceRecorder


def test_trace_recorder_lifecycle():
    trace = TraceRecorder(run_id="run_test")
    span = trace.start("unit", {"ok": True})
    trace.finish(span, {"duration_ms": 1})

    data = trace.as_dict()

    assert data["run_id"] == "run_test"
    assert len(data["events"]) == 2
    assert data["events"][0]["metadata"]["ok"] is True
    assert data["events"][0]["metadata"]["request_id"].startswith("req_")
    assert data["events"][1]["type"] == "workflow.step"
    assert data["events"][1]["parent_id"] == span


def test_trace_recorder_normalizes_event_types_and_decision_metadata():
    trace = TraceRecorder(run_id="run_decision")
    span = trace.start(
        "tool.call",
        {
            "decision": trace.decision(
                proposal_summary="Try deployment",
                changed_fields=["region"],
                outcome_label="success",
            )
        },
    )

    data = trace.as_dict()

    assert span.startswith("evt_")
    assert data["events"][0]["type"] == "mcp.tool_call"
    assert data["events"][0]["metadata"]["decision"]["changed_fields"] == ["region"]
    assert data["events"][0]["metadata"]["decision"]["redaction_version"] == "decision-redacted-v1"


def test_trace_recorder_normalizes_state_reference_aliases():
    trace = TraceRecorder(run_id="run_state")
    trace.start(
        "langgraph.checkpoint",
        {
            "state_reference": {
                "reference_type": "langgraph_checkpoint",
                "external_id": "thread-123/checkpoint-456",
            }
        },
    )

    data = trace.as_dict()

    assert data["events"][0]["type"] == "state.reference"
    assert data["events"][0]["metadata"]["state_reference"]["reference_type"] == "langgraph_checkpoint"
