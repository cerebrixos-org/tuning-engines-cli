from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any

EVENT_ALIASES = {
    "llm": "model.call",
    "llm.call": "model.call",
    "model": "model.call",
    "embedding": "model.embedding",
    "mcp": "mcp.tool_call",
    "tool": "mcp.tool_call",
    "tool.call": "mcp.tool_call",
    "agent": "agent.message",
    "agent.invoke": "agent.message",
    "langgraph.agent.invoke": "agent.message",
    "skill": "skill.invoke",
    "workflow": "workflow.step",
    "temporal.activity": "workflow.step",
    "span.finish": "workflow.step",
    "span.error": "workflow.step",
    "human_edit": "human.edit",
    "final_action": "action.finalized",
    "outcome": "outcome.recorded",
}

EVENT_TYPES = {
    "model.call",
    "model.embedding",
    "mcp.tool_call",
    "skill.invoke",
    "agent.message",
    "workflow.step",
    "policy.decision",
    "approval.requested",
    "approval.approved",
    "approval.denied",
    "human.edit",
    "action.finalized",
    "outcome.recorded",
}


@dataclass(slots=True)
class TraceEvent:
    id: str
    type: str
    status: str
    at: float
    parent_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class TraceRecorder:
    """In-process trace collector for agent runs.

    This captures the full SDK-side causal chain. Rails already records
    gateway usage, request capture, audit, and token economics. Persist these
    events in your app or forward them once a public trace-ingest endpoint is
    added.
    """

    run_id: str = field(default_factory=lambda: f"run_{uuid.uuid4().hex}")
    events: list[TraceEvent] = field(default_factory=list)

    def new_request_id(self) -> str:
        return f"req_{uuid.uuid4().hex}"

    def normalize_event_type(self, event_type: str | None) -> str:
        raw = (event_type or "").strip()
        if not raw:
            return "custom.event"
        normalized = raw.lower().replace("_", ".")
        if normalized in EVENT_TYPES:
            return normalized
        if normalized in EVENT_ALIASES:
            return EVENT_ALIASES[normalized]
        return normalized if normalized.startswith("custom.") else f"custom.{normalized}"

    def decision(
        self,
        *,
        proposal_summary: str | None = None,
        changed_fields: list[str] | None = None,
        change_summary: str | None = None,
        change_type: str | None = None,
        final_action: str | None = None,
        outcome_label: str | None = None,
        outcome_score: float | None = None,
        reason_summary: str | None = None,
    ) -> dict[str, Any]:
        return {
            key: value
            for key, value in {
                "proposal_summary": proposal_summary,
                "changed_fields": changed_fields,
                "change_summary": change_summary,
                "change_type": change_type,
                "final_action": final_action,
                "outcome_label": outcome_label,
                "outcome_score": outcome_score,
                "reason_summary": reason_summary,
                "redaction_version": "decision-redacted-v1",
            }.items()
            if value is not None
        }

    def start(self, event_type: str, metadata: dict[str, Any] | None = None, parent_id: str | None = None) -> str:
        event_id = f"evt_{uuid.uuid4().hex}"
        request_id = (metadata or {}).get("request_id") or self.new_request_id()
        self.events.append(
            TraceEvent(
                id=event_id,
                type=self.normalize_event_type(event_type),
                status="started",
                at=time.time(),
                parent_id=parent_id,
                metadata={"run_id": self.run_id, "agent_run_id": self.run_id, "request_id": request_id, **(metadata or {})},
            )
        )
        return event_id

    def finish(self, event_id: str, metadata: dict[str, Any] | None = None) -> None:
        request_id = (metadata or {}).get("request_id") or self.new_request_id()
        self.events.append(
            TraceEvent(
                id=f"evt_{uuid.uuid4().hex}",
                type="workflow.step",
                status="succeeded",
                at=time.time(),
                parent_id=event_id,
                metadata={"run_id": self.run_id, "agent_run_id": self.run_id, "request_id": request_id, **(metadata or {})},
            )
        )

    def error(self, event_id: str, exc: BaseException) -> None:
        request_id = self.new_request_id()
        self.events.append(
            TraceEvent(
                id=f"evt_{uuid.uuid4().hex}",
                type="workflow.step",
                status="failed",
                at=time.time(),
                parent_id=event_id,
                metadata={
                    "run_id": self.run_id,
                    "agent_run_id": self.run_id,
                    "request_id": request_id,
                    "error_type": exc.__class__.__name__,
                    "error": str(exc),
                },
            )
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "events": [
                {
                    "id": event.id,
                    "type": event.type,
                    "status": event.status,
                    "at": event.at,
                    "parent_id": event.parent_id,
                    "metadata": event.metadata,
                }
                for event in self.events
            ],
        }
