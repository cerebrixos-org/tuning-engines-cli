from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Literal

import httpx

LOGGER = logging.getLogger(__name__)
CAPTURE_MODE = "metadata_only"
REDACTION_VERSION = "openai-agents-metadata-v1"


def _bounded(value: Any, limit: int = 240) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split())
    return text[:limit] if text else None


def _identifier(prefix: str, value: Any, length: int = 28) -> str:
    digest = hashlib.sha256(str(value).encode()).hexdigest()[:length]
    return f"{prefix}_{digest}"


def _safe_usage(value: Any) -> dict[str, float | int]:
    if not isinstance(value, dict):
        return {}
    return {
        str(key): number
        for key, number in value.items()
        if isinstance(number, (int, float)) and not isinstance(number, bool)
    }


def _event_type(span_type: str) -> str:
    return {
        "response": "model.call",
        "generation": "model.call",
        "function": "agent.tool_call",
        "mcp_tools": "mcp.tool_call",
        "handoff": "agent.message",
        "agent": "agent.message",
        "guardrail": "policy.decision",
        "task": "workflow.step",
        "turn": "workflow.step",
    }.get(span_type, "custom.openai_agents")


def _summary(span_type: str, data: dict[str, Any], failed: bool) -> str:
    if span_type == "function":
        name = _bounded(data.get("name"), 120) or "Tool"
        return f"{name} failed" if failed else f"{name} completed"
    if span_type in {"response", "generation"}:
        return "Model call failed" if failed else "Model call completed"
    if span_type == "handoff":
        source = _bounded(data.get("from_agent"), 80) or "agent"
        target = _bounded(data.get("to_agent"), 80) or "agent"
        return f"Agent handoff: {source} to {target}"
    if span_type == "guardrail":
        return f"Guardrail evaluated: {_bounded(data.get('name'), 100) or 'guardrail'}"
    return _bounded(data.get("name") or span_type.replace("_", " "), 160) or "Agent step"


def normalize_exported_item(item: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    object_type = str(item.get("object") or "")
    if object_type == "trace":
        trace_id = str(item.get("id") or item.get("trace_id") or "unknown")
        return _identifier("run_oai", trace_id), {
            "trace": True,
            "name": _bounded(item.get("workflow_name") or item.get("name"), 160),
            "group_id": _bounded(item.get("group_id"), 160),
        }
    if object_type != "trace.span":
        return None

    trace_id = str(item.get("trace_id") or "unknown")
    span_id = str(item.get("id") or _identifier("span_oai", json.dumps(item, sort_keys=True)))
    run_id = _identifier("run_oai", trace_id)
    request_id = _identifier("req_oai", f"{trace_id}:{span_id}")
    span_data = item.get("span_data") if isinstance(item.get("span_data"), dict) else {}
    span_type = str(span_data.get("type") or "custom").lower()
    error = item.get("error")
    failed = bool(error) or bool(span_data.get("is_error"))
    metadata: dict[str, Any] = {
        "run_id": run_id,
        "request_id": request_id,
        "runtime": "openai_agents",
        "telemetry_source": "native_sdk",
        "native_trace_id": _bounded(trace_id, 200),
        "native_span_id": _bounded(span_id, 200),
        "native_span_type": span_type,
        "capture_mode": CAPTURE_MODE,
        "redaction_version": REDACTION_VERSION,
        "human_summary": _summary(span_type, span_data, failed),
    }
    if span_data.get("name") is not None:
        metadata["resource_name"] = _bounded(span_data.get("name"), 160)
    if span_data.get("model") is not None:
        metadata["model"] = _bounded(span_data.get("model"), 160)
    if usage := _safe_usage(span_data.get("usage")):
        metadata["usage"] = usage
    if span_type == "guardrail":
        metadata["triggered"] = bool(span_data.get("triggered"))
    if span_type == "handoff":
        metadata["from_agent"] = _bounded(span_data.get("from_agent"), 120)
        metadata["to_agent"] = _bounded(span_data.get("to_agent"), 120)
    if error:
        metadata["error_type"] = _bounded(
            error.get("type") if isinstance(error, dict) else type(error).__name__, 120
        )
        metadata["error_message"] = "Agent operation failed"

    return run_id, {
        "request_id": request_id,
        "event": {
            "id": _identifier("evt_oai", span_id),
            "parent_id": _identifier("evt_oai", item["parent_id"])
            if item.get("parent_id")
            else None,
            "type": _event_type(span_type),
            "status": "failed" if failed else "succeeded",
            "at": item.get("ended_at") or item.get("started_at"),
            "metadata": {key: value for key, value in metadata.items() if value is not None},
        },
    }


class TuningEnginesTraceExporter:
    """OpenAI Agents trace exporter with bounded metadata-only capture."""

    def __init__(
        self,
        *,
        api_key: str,
        api_url: str = "https://app.tuningengines.com",
        timeout: float = 10.0,
        max_retries: int = 3,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.api_key = api_key
        self.api_url = api_url.rstrip("/")
        self.max_retries = max(1, max_retries)
        self.client = httpx.Client(timeout=timeout, transport=transport)

    def export(self, items: list[Any]) -> None:
        grouped: dict[str, dict[str, Any]] = {}
        for item in items:
            exported = item.export() if hasattr(item, "export") else item
            if not isinstance(exported, dict):
                continue
            normalized = normalize_exported_item(exported)
            if normalized is None:
                continue
            run_id, detail = normalized
            group = grouped.setdefault(run_id, {"events": [], "metadata": {}})
            if detail.get("trace"):
                group["name"] = detail.get("name")
                group["metadata"]["native_group_id"] = detail.get("group_id")
            else:
                group["events"].append(detail["event"])
                group.setdefault("request_id", detail.get("request_id"))

        for run_id, group in grouped.items():
            if not group["events"]:
                continue
            payload = {
                "run_id": run_id,
                "request_id": group.get("request_id"),
                "name": group.get("name") or "OpenAI Agents run",
                "runtime": "openai_agents",
                "telemetry_source": "native_sdk",
                "status": "failed"
                if any(event["status"] == "failed" for event in group["events"])
                else "succeeded",
                "metadata": {
                    "capture_mode": CAPTURE_MODE,
                    "redaction_version": REDACTION_VERSION,
                    **{key: value for key, value in group["metadata"].items() if value is not None},
                },
                "events": group["events"],
            }
            self._post(payload)

    def _post(self, payload: dict[str, Any]) -> None:
        last_error: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                response = self.client.post(
                    f"{self.api_url}/api/v1/traces",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "User-Agent": "tuning-engines/0.1.4 openai-agents",
                    },
                    json=payload,
                )
                response.raise_for_status()
                return
            except httpx.HTTPError as exc:  # tracing must never break the agent run
                last_error = exc
                if attempt + 1 < self.max_retries:
                    time.sleep(0.2 * (2**attempt))
        LOGGER.warning("Tuning Engines trace export failed after retries: %s", last_error)

    def close(self) -> None:
        self.client.close()


@dataclass(slots=True)
class OpenAIAgentsIntegration:
    processor: Any
    exporter: TuningEnginesTraceExporter

    def force_flush(self) -> None:
        self.processor.force_flush()

    def shutdown(self, timeout: float | None = None) -> None:
        self.processor.shutdown(timeout=timeout)
        self.exporter.close()


def configure_openai_agents(
    *,
    inference_key: str | None = None,
    api_key: str | None = None,
    inference_url: str = "https://api.tuningengines.com/v1",
    api_url: str = "https://app.tuningengines.com",
    api: Literal["chat_completions", "responses"] = "chat_completions",
    schedule_delay: float = 2.0,
    max_batch_size: int = 128,
    replace_default_tracing: bool = True,
) -> OpenAIAgentsIntegration:
    """Route OpenAI Agents calls through TE and export native SDK traces to TE."""

    from agents import (
        add_trace_processor,
        set_default_openai_api,
        set_default_openai_client,
        set_trace_processors,
    )
    from agents.tracing.processors import BatchTraceProcessor
    from openai import AsyncOpenAI

    model_key = inference_key or os.getenv("TE_INFERENCE_KEY")
    trace_key = api_key or os.getenv("TE_API_KEY") or model_key
    if not model_key or not trace_key:
        raise ValueError("TE_INFERENCE_KEY (and optionally TE_API_KEY) is required")

    client = AsyncOpenAI(api_key=model_key, base_url=inference_url.rstrip("/"))
    set_default_openai_client(client, use_for_tracing=False)
    set_default_openai_api(api)
    exporter = TuningEnginesTraceExporter(api_key=trace_key, api_url=api_url)
    processor = BatchTraceProcessor(
        exporter, max_batch_size=max_batch_size, schedule_delay=schedule_delay
    )
    if replace_default_tracing:
        set_trace_processors([processor])
    else:
        add_trace_processor(processor)
    return OpenAIAgentsIntegration(processor=processor, exporter=exporter)
