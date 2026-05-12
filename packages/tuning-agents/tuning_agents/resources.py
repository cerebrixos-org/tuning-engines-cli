from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .mcp import agent_tool_spec, skill_tool_spec


@dataclass(slots=True)
class ResourceManifest:
    """Runtime-facing manifest for governed Tuning Engines resources.

    Use this when the application knows which agents/skills should be exposed
    to a run. The proxy still enforces RBAC/AGT using the tenant registry.
    """

    model: str = "auto"
    agents: dict[str, str] = field(default_factory=dict)
    skills: dict[str, str] = field(default_factory=dict)
    extra_tools: list[dict[str, Any]] = field(default_factory=list)

    def openai_tools(self) -> list[dict[str, Any]]:
        tools = list(self.extra_tools)
        tools.extend(agent_tool_spec(name, description=description) for name, description in self.agents.items())
        tools.extend(skill_tool_spec(name, description=description) for name, description in self.skills.items())
        return tools
