from .trace import TraceEvent, TraceRecorder

__all__ = ["TuningClient", "TraceEvent", "TraceRecorder"]


def __getattr__(name: str):
    if name == "TuningClient":
        from .client import TuningClient

        return TuningClient
    raise AttributeError(name)
