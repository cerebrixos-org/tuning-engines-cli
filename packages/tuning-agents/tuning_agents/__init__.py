from .temporal import (
    TuningEnginesPlugin,
    TuningEnginesTemporalFeatures,
    TuningEnginesTemporalPluginConfig,
    create_tuning_engines_plugin,
)
from .trace import TraceEvent, TraceRecorder

__all__ = [
    "TuningClient",
    "TuningError",
    "TraceEvent",
    "TraceRecorder",
    "TuningEnginesPlugin",
    "TuningEnginesTemporalFeatures",
    "TuningEnginesTemporalPluginConfig",
    "create_tuning_engines_plugin",
]


def __getattr__(name: str):
    if name == "TuningClient":
        from .client import TuningClient

        return TuningClient
    if name == "TuningError":
        from .client import TuningError

        return TuningError
    raise AttributeError(name)
