from tuning_agents.trace import TraceRecorder


def test_trace_recorder_lifecycle():
    trace = TraceRecorder(run_id="run_test")
    span = trace.start("unit", {"ok": True})
    trace.finish(span, {"duration_ms": 1})

    data = trace.as_dict()

    assert data["run_id"] == "run_test"
    assert len(data["events"]) == 2
    assert data["events"][0]["metadata"]["ok"] is True
    assert data["events"][1]["parent_id"] == span
