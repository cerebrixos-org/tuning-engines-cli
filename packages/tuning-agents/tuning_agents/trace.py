from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any


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

    def start(self, event_type: str, metadata: dict[str, Any] | None = None, parent_id: str | None = None) -> str:
        event_id = f"evt_{uuid.uuid4().hex}"
        self.events.append(
            TraceEvent(
                id=event_id,
                type=event_type,
                status="started",
                at=time.time(),
                parent_id=parent_id,
                metadata={"run_id": self.run_id, **(metadata or {})},
            )
        )
        return event_id

    def finish(self, event_id: str, metadata: dict[str, Any] | None = None) -> None:
        self.events.append(
            TraceEvent(
                id=f"evt_{uuid.uuid4().hex}",
                type="span.finish",
                status="succeeded",
                at=time.time(),
                parent_id=event_id,
                metadata={"run_id": self.run_id, **(metadata or {})},
            )
        )

    def error(self, event_id: str, exc: BaseException) -> None:
        self.events.append(
            TraceEvent(
                id=f"evt_{uuid.uuid4().hex}",
                type="span.error",
                status="failed",
                at=time.time(),
                parent_id=event_id,
                metadata={
                    "run_id": self.run_id,
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
