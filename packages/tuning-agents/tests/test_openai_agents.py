from __future__ import annotations

import json

import httpx

from tuning_agents.openai_agents import TuningEnginesTraceExporter, normalize_exported_item


def test_function_span_omits_tool_input_and_output() -> None:
    normalized = normalize_exported_item(
        {
            "object": "trace.span",
            "id": "span_1",
            "trace_id": "trace_1",
            "span_data": {
                "type": "function",
                "name": "lookup_customer",
                "input": '{"password":"secret"}',
                "output": "private customer record",
            },
        }
    )
    assert normalized is not None
    _, detail = normalized
    assert detail["event"]["type"] == "agent.tool_call"
    assert detail["event"]["metadata"]["resource_name"] == "lookup_customer"
    encoded = json.dumps(detail)
    assert "password" not in encoded
    assert "private customer record" not in encoded


def test_failed_span_is_marked_failed_without_raw_error() -> None:
    normalized = normalize_exported_item(
        {
            "object": "trace.span",
            "id": "span_2",
            "trace_id": "trace_1",
            "span_data": {"type": "function", "name": "delete_file"},
            "error": {"type": "ToolError", "message": "secret path /tmp/private"},
        }
    )
    assert normalized is not None
    _, detail = normalized
    assert detail["event"]["status"] == "failed"
    assert detail["event"]["metadata"]["error_type"] == "ToolError"
    assert "secret path" not in json.dumps(detail)


def test_exporter_batches_spans_by_trace() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(202, json={"accepted": True})

    exporter = TuningEnginesTraceExporter(
        api_key="sk-test", transport=httpx.MockTransport(handler)
    )
    exporter.export(
        [
            {
                "object": "trace.span",
                "id": "span_1",
                "trace_id": "trace_1",
                "span_data": {
                    "type": "generation",
                    "model": "te-model",
                    "usage": {"input_tokens": 10},
                },
            },
            {
                "object": "trace.span",
                "id": "span_2",
                "trace_id": "trace_1",
                "parent_id": "span_1",
                "span_data": {"type": "function", "name": "search"},
            },
        ]
    )
    assert len(requests) == 1
    payload = json.loads(requests[0].content)
    assert payload["runtime"] == "openai_agents"
    assert len(payload["events"]) == 2
    assert payload["events"][1]["parent_id"] == payload["events"][0]["id"]
