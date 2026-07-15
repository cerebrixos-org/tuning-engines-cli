from __future__ import annotations

import os
import time
import uuid
from collections.abc import Mapping
from dataclasses import dataclass, field
from importlib.metadata import PackageNotFoundError, version
from typing import Any
from urllib.parse import urlencode

import httpx
from openai import OpenAI

from .trace import TraceRecorder

try:
    SDK_VERSION = version("tuning-engines")
except PackageNotFoundError:  # pragma: no cover - editable/local source tree fallback
    SDK_VERSION = "0.1.1"


class TuningError(RuntimeError):
    pass


@dataclass(slots=True)
class TuningClient:
    """Small client for Tuning Engines control-plane and inference APIs.

    The API key can be a long-lived inference key (`sk-te-...`) when talking
    directly to the proxy, or a platform API token when using `/api/v1/*`.
    """

    api_key: str | None = None
    api_url: str = "https://app.tuningengines.com"
    inference_url: str = "https://api.tuningengines.com/v1"
    timeout: float = 60.0
    user_agent: str = field(default_factory=lambda: f"tuning-agents/{SDK_VERSION}")
    trace: TraceRecorder = field(default_factory=TraceRecorder)
    _api_access_token: str | None = field(default=None, init=False, repr=False)
    _api_access_token_expires_at: float = field(default=0.0, init=False, repr=False)

    def __post_init__(self) -> None:
        self.api_key = self.api_key or os.getenv("TE_API_KEY")
        if not self.api_key:
            raise ValueError("api_key is required or TE_API_KEY must be set")
        self.api_url = self.api_url.rstrip("/")
        self.inference_url = self.inference_url.rstrip("/")

    @property
    def openai(self) -> OpenAI:
        return self.openai_client()

    def openai_client(
        self,
        *,
        approval_id: str | None = None,
        request_id: str | None = None,
        run_id: str | None = None,
    ) -> OpenAI:
        headers = {
            "X-TE-Request-ID": request_id,
            "X-TE-Run-ID": run_id or self.trace.run_id,
            "X-TE-Approval-ID": approval_id,
        }
        return OpenAI(
            api_key=self.api_key,
            base_url=self.inference_url,
            timeout=self.timeout,
            default_headers={k: v for k, v in headers.items() if v},
        )

    def request(
        self,
        method: str,
        path: str,
        *,
        json: Mapping[str, Any] | None = None,
        base_url: str | None = None,
        trace_type: str = "http",
        headers: Mapping[str, str] | None = None,
    ) -> Any:
        url = f"{(base_url or self.api_url).rstrip('/')}/{path.lstrip('/')}"
        body = dict(json or {})
        body_metadata = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}
        request_id = str(body_metadata.get("request_id") or self.trace.new_request_id())
        if body_metadata:
            body["metadata"] = {
                **body_metadata,
                "run_id": body_metadata.get("run_id") or self.trace.run_id,
                "agent_run_id": body_metadata.get("agent_run_id") or self.trace.run_id,
                "request_id": request_id,
            }
        span_id = self.trace.start(trace_type, {"method": method, "url": url, "request_id": request_id})
        started = time.perf_counter()
        try:
            trace_headers = {"X-TE-Request-ID": request_id, "X-TE-Run-ID": self.trace.run_id, **dict(headers or {})}
            with httpx.Client(timeout=self.timeout, headers=self._headers(trace_headers, path=path, base_url=base_url)) as client:
                response = client.request(method, url, json=body if json is not None else None)
            payload = self._parse_response(response)
            self.trace.finish(
                span_id,
                {
                    "status_code": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            return payload
        except Exception as exc:
            self.trace.error(span_id, exc)
            raise

    async def arequest(
        self,
        method: str,
        path: str,
        *,
        json: Mapping[str, Any] | None = None,
        base_url: str | None = None,
        trace_type: str = "http",
        headers: Mapping[str, str] | None = None,
    ) -> Any:
        url = f"{(base_url or self.api_url).rstrip('/')}/{path.lstrip('/')}"
        body = dict(json or {})
        body_metadata = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}
        request_id = str(body_metadata.get("request_id") or self.trace.new_request_id())
        if body_metadata:
            body["metadata"] = {
                **body_metadata,
                "run_id": body_metadata.get("run_id") or self.trace.run_id,
                "agent_run_id": body_metadata.get("agent_run_id") or self.trace.run_id,
                "request_id": request_id,
            }
        span_id = self.trace.start(trace_type, {"method": method, "url": url, "request_id": request_id})
        started = time.perf_counter()
        try:
            trace_headers = {"X-TE-Request-ID": request_id, "X-TE-Run-ID": self.trace.run_id, **dict(headers or {})}
            headers_with_auth = await self._aheaders(trace_headers, path=path, base_url=base_url)
            async with httpx.AsyncClient(timeout=self.timeout, headers=headers_with_auth) as client:
                response = await client.request(method, url, json=body if json is not None else None)
            payload = self._parse_response(response)
            self.trace.finish(
                span_id,
                {
                    "status_code": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            return payload
        except Exception as exc:
            self.trace.error(span_id, exc)
            raise

    def chat(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        approval_id: str | None = None,
        **kwargs: Any,
    ) -> Any:
        request_id = self.trace.new_request_id()
        call_metadata = {
            **dict(kwargs.get("metadata") or {}),
            "run_id": self.trace.run_id,
            "agent_run_id": self.trace.run_id,
            "request_id": request_id,
            "event_type": "model.call",
        }
        span_id = self.trace.start("model.call", {"model": model, "request_id": request_id})
        try:
            clean_kwargs = {key: value for key, value in kwargs.items() if value is not None}
            clean_kwargs["metadata"] = call_metadata
            response = self.openai_client(
                approval_id=approval_id,
                request_id=request_id,
                run_id=self.trace.run_id,
            ).chat.completions.create(
                model=model,
                messages=messages,
                **clean_kwargs,
            )
            usage = getattr(response, "usage", None)
            self.trace.finish(
                span_id,
                {
                    "model": getattr(response, "model", model),
                    "request_id": request_id,
                    "usage": usage.model_dump() if hasattr(usage, "model_dump") else usage,
                },
            )
            return response
        except Exception as exc:
            self.trace.error(span_id, exc)
            raise

    def list_models(self) -> Any:
        return self.request("GET", "/api/v1/inference/models", trace_type="control")

    def list_training_agents(
        self,
        *,
        category: str | None = None,
        include_disabled: bool = False,
    ) -> Any:
        params = []
        if category:
            params.append(f"category={category}")
        if include_disabled:
            params.append("include_disabled=true")
        query = f"?{'&'.join(params)}" if params else ""
        return self.request("GET", f"/api/v1/agents{query}", trace_type="control")

    def list_usage(self, *, model: str | None = None, limit: int | None = None) -> Any:
        params = []
        if model:
            params.append(f"model={model}")
        if limit:
            params.append(f"limit={limit}")
        query = f"?{'&'.join(params)}" if params else ""
        return self.request("GET", f"/api/v1/inference/usage{query}", trace_type="control")

    def bulk_import_resources(
        self,
        *,
        target_type: str,
        rows: list[Mapping[str, Any]],
        dry_run: bool = True,
    ) -> Any:
        return self.request(
            "POST",
            "/api/v1/bulk_imports",
            json={"target_type": target_type, "rows": rows, "dry_run": dry_run},
            trace_type="control",
        )

    def flush_trace(
        self,
        *,
        name: str | None = None,
        runtime: str = "custom",
        status: str = "running",
        metadata: Mapping[str, Any] | None = None,
    ) -> Any:
        trace = self.trace.as_dict()
        return self.request(
            "POST",
            "/api/v1/traces",
            json={
                "run_id": trace["run_id"],
                "name": name,
                "runtime": runtime,
                "status": status,
                "metadata": dict(metadata or {}),
                "events": trace["events"],
            },
            trace_type="control",
        )

    def upsert_state_reference(self, reference: Mapping[str, Any]) -> Any:
        """Record a safe pointer to external workflow state or memory.

        Tuning Engines stores metadata and IDs only. Keep raw memory content,
        prompts, embeddings, signed URLs, and secrets in the owning runtime.
        """
        return self.request(
            "POST",
            "/api/v1/runtime_state_references",
            json={"runtime_state_reference": dict(reference)},
            trace_type="control",
        )

    async def aupsert_state_reference(self, reference: Mapping[str, Any]) -> Any:
        return await self.arequest(
            "POST",
            "/api/v1/runtime_state_references",
            json={"runtime_state_reference": dict(reference)},
            trace_type="control",
        )

    def call_agent(
        self,
        *,
        agent_name: str,
        message: str,
        context: Mapping[str, Any] | None = None,
        approval_id: str | None = None,
    ) -> Any:
        return self.request(
            "POST",
            f"/v1/agents/{agent_name}/message",
            base_url=self.inference_url.removesuffix("/v1"),
            json={
                "message": message,
                "context": dict(context or {}),
                "metadata": {
                    "run_id": self.trace.run_id,
                    "agent_run_id": self.trace.run_id,
                    "request_id": self.trace.new_request_id(),
                    "event_type": "agent.message",
                },
            },
            trace_type="agent",
            headers={"X-TE-Approval-ID": approval_id} if approval_id else None,
        )

    async def acall_agent(
        self,
        *,
        agent_name: str,
        message: str,
        context: Mapping[str, Any] | None = None,
        approval_id: str | None = None,
    ) -> Any:
        return await self.arequest(
            "POST",
            f"/v1/agents/{agent_name}/message",
            base_url=self.inference_url.removesuffix("/v1"),
            json={
                "message": message,
                "context": dict(context or {}),
                "metadata": {
                    "run_id": self.trace.run_id,
                    "agent_run_id": self.trace.run_id,
                    "request_id": self.trace.new_request_id(),
                    "event_type": "agent.message",
                },
            },
            trace_type="agent",
            headers={"X-TE-Approval-ID": approval_id} if approval_id else None,
        )

    def list_mcp_tools(self) -> Any:
        return self.request("GET", "/v1/mcp/tools", base_url=self.inference_url.removesuffix("/v1"), trace_type="mcp")

    def call_mcp_tool(
        self,
        *,
        server_name: str,
        tool_name: str,
        arguments: Mapping[str, Any] | None = None,
        approval_id: str | None = None,
    ) -> Any:
        return self.request(
            "POST",
            "/v1/mcp/tools/call",
            base_url=self.inference_url.removesuffix("/v1"),
            json={
                "server_name": server_name,
                "tool_name": tool_name,
                "arguments": dict(arguments or {}),
                "metadata": {
                    "run_id": self.trace.run_id,
                    "agent_run_id": self.trace.run_id,
                    "request_id": self.trace.new_request_id(),
                    "event_type": "mcp.tool_call",
                },
            },
            trace_type="mcp",
            headers={"X-TE-Approval-ID": approval_id} if approval_id else None,
        )

    async def acall_mcp_tool(
        self,
        *,
        server_name: str,
        tool_name: str,
        arguments: Mapping[str, Any] | None = None,
        approval_id: str | None = None,
    ) -> Any:
        return await self.arequest(
            "POST",
            "/v1/mcp/tools/call",
            base_url=self.inference_url.removesuffix("/v1"),
            json={
                "server_name": server_name,
                "tool_name": tool_name,
                "arguments": dict(arguments or {}),
                "metadata": {
                    "run_id": self.trace.run_id,
                    "agent_run_id": self.trace.run_id,
                    "request_id": self.trace.new_request_id(),
                    "event_type": "mcp.tool_call",
                },
            },
            trace_type="mcp",
            headers={"X-TE-Approval-ID": approval_id} if approval_id else None,
        )

    def list_interventions(
        self,
        *,
        run_id: str,
        status: str | None = None,
        kind: str | None = None,
    ) -> Any:
        params = {"run_id": run_id, "status": status, "kind": kind}
        query = urlencode({key: value for key, value in params.items() if value})
        return self.request("GET", f"/api/v1/runtime_interventions?{query}", trace_type="control")

    def ack_intervention(self, intervention_id: str, *, metadata: Mapping[str, Any] | None = None) -> Any:
        return self.request(
            "POST",
            f"/api/v1/runtime_interventions/{intervention_id}/ack",
            json={"metadata": dict(metadata or {})},
            trace_type="control",
        )

    def complete_intervention(self, intervention_id: str, *, metadata: Mapping[str, Any] | None = None) -> Any:
        return self.request(
            "POST",
            f"/api/v1/runtime_interventions/{intervention_id}/complete",
            json={"metadata": dict(metadata or {})},
            trace_type="control",
        )

    def fail_intervention(self, intervention_id: str, *, metadata: Mapping[str, Any] | None = None) -> Any:
        return self.request(
            "POST",
            f"/api/v1/runtime_interventions/{intervention_id}/fail",
            json={"metadata": dict(metadata or {})},
            trace_type="control",
        )

    def record_state_reference(
        self,
        *,
        reference_type: str,
        external_id: str,
        run_id: str | None = None,
        provider: str | None = None,
        uri: str | None = None,
        runtime: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        resource_name: str | None = None,
        status: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> Any:
        payload = {
            "reference_type": reference_type,
            "external_id": external_id,
            "run_id": run_id or self.trace.run_id,
            "provider": provider,
            "uri": uri,
            "runtime": runtime,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "resource_name": resource_name,
            "status": status,
            "metadata": dict(metadata or {}),
        }
        return self.request(
            "POST",
            "/api/v1/runtime_state_references",
            json={key: value for key, value in payload.items() if value is not None},
            trace_type="control",
        )

    def list_state_references(
        self,
        *,
        run_id: str,
        reference_type: str | None = None,
        provider: str | None = None,
    ) -> Any:
        params = {"run_id": run_id, "reference_type": reference_type, "provider": provider}
        query = urlencode({key: value for key, value in params.items() if value})
        return self.request("GET", f"/api/v1/runtime_state_references?{query}", trace_type="control")

    def new_run_id(self, prefix: str = "run") -> str:
        return f"{prefix}_{uuid.uuid4().hex}"

    def _headers(
        self,
        extra: Mapping[str, str] | None = None,
        *,
        path: str | None = None,
        base_url: str | None = None,
    ) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self._bearer_token(path=path, base_url=base_url)}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": self.user_agent,
        }
        headers.update({k: v for k, v in (extra or {}).items() if v})
        return headers

    async def _aheaders(
        self,
        extra: Mapping[str, str] | None = None,
        *,
        path: str | None = None,
        base_url: str | None = None,
    ) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {await self._abearer_token(path=path, base_url=base_url)}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": self.user_agent,
        }
        headers.update({k: v for k, v in (extra or {}).items() if v})
        return headers

    def _bearer_token(self, *, path: str | None, base_url: str | None) -> str:
        if self._needs_api_jwt(path=path, base_url=base_url):
            return self._api_jwt()
        return str(self.api_key)

    async def _abearer_token(self, *, path: str | None, base_url: str | None) -> str:
        if self._needs_api_jwt(path=path, base_url=base_url):
            return await self._aapi_jwt()
        return str(self.api_key)

    def _needs_api_jwt(self, *, path: str | None, base_url: str | None) -> bool:
        if not str(self.api_key).startswith("te_"):
            return False
        resolved_base_url = (base_url or self.api_url).rstrip("/")
        return resolved_base_url == self.api_url and str(path or "").startswith("/api/v1/")

    def _api_jwt(self) -> str:
        now = time.time()
        if self._api_access_token and self._api_access_token_expires_at - now > 60:
            return self._api_access_token
        with httpx.Client(timeout=self.timeout, headers=self._raw_headers()) as client:
            response = client.post(f"{self.api_url}/api/v1/auth/token")
        payload = self._parse_response(response)
        return self._cache_api_jwt(payload)

    async def _aapi_jwt(self) -> str:
        now = time.time()
        if self._api_access_token and self._api_access_token_expires_at - now > 60:
            return self._api_access_token
        async with httpx.AsyncClient(timeout=self.timeout, headers=self._raw_headers()) as client:
            response = await client.post(f"{self.api_url}/api/v1/auth/token")
        payload = self._parse_response(response)
        return self._cache_api_jwt(payload)

    def _cache_api_jwt(self, payload: Any) -> str:
        token = payload.get("access_token") if isinstance(payload, dict) else None
        if not token:
            raise TuningError("Tuning Engines API error: authentication token exchange did not return an access token")
        expires_in = float(payload.get("expires_in") or 900)
        self._api_access_token = str(token)
        self._api_access_token_expires_at = time.time() + expires_in
        return self._api_access_token

    def _raw_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": self.user_agent,
        }

    @staticmethod
    def _parse_response(response: httpx.Response) -> Any:
        text = response.text
        try:
            payload = response.json() if text else {}
        except ValueError:
            payload = text
        if response.status_code >= 400:
            message = None
            if isinstance(payload, dict):
                message = payload.get("error") or payload.get("detail")
            else:
                message = payload
            raise TuningError(f"Tuning Engines API error {response.status_code}: {message}")
        return payload
