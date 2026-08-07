import httpx

from tuning_agents.client import TuningClient


class FakeHttpClient:
    calls = []

    def __init__(self, *, timeout, headers):
        self.timeout = timeout
        self.headers = headers

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def post(self, url):
        self.calls.append(("POST", url, dict(self.headers)))
        return httpx.Response(200, json={"access_token": "jwt_test", "expires_in": 900})

    def request(self, method, url, json=None):
        self.calls.append((method, url, dict(self.headers)))
        return httpx.Response(200, json={"ok": True})


def test_platform_token_is_exchanged_for_control_plane_calls(monkeypatch):
    FakeHttpClient.calls = []
    monkeypatch.setattr(httpx, "Client", FakeHttpClient)

    client = TuningClient(api_key="te_platform_test", api_url="https://app.example.test")
    payload = client.request("GET", "/api/v1/inference/models")

    assert payload == {"ok": True}
    assert FakeHttpClient.calls[0][0:2] == ("POST", "https://app.example.test/api/v1/auth/token")
    assert FakeHttpClient.calls[0][2]["Authorization"] == "Bearer te_platform_test"
    assert FakeHttpClient.calls[1][2]["Authorization"] == "Bearer jwt_test"


def test_inference_key_is_not_exchanged_for_proxy_calls(monkeypatch):
    FakeHttpClient.calls = []
    monkeypatch.setattr(httpx, "Client", FakeHttpClient)

    client = TuningClient(api_key="sk-te-inference-test", inference_url="https://api.example.test/v1")
    payload = client.request("GET", "/v1/mcp/tools", base_url="https://api.example.test")

    assert payload == {"ok": True}
    assert len(FakeHttpClient.calls) == 1
    assert FakeHttpClient.calls[0][2]["Authorization"] == "Bearer sk-te-inference-test"


def test_user_agent_uses_installed_package_version():
    client = TuningClient(api_key="sk-te-inference-test")

    assert client.user_agent.startswith("tuning-agents/")
    assert client.user_agent != "tuning-agents/0.1.0"


def test_trajectory_and_asset_helpers_use_control_plane_contract(monkeypatch):
    FakeHttpClient.calls = []
    monkeypatch.setattr(httpx, "Client", FakeHttpClient)
    client = TuningClient(api_key="sk-te-inference-test", api_url="https://app.example.test")

    client.list_ai_system_assets(asset_type="agent", limit=25)
    client.freeze_evidence_set(initiative_id="ini_1", work_item_ids=["wis_1"])
    client.start_intelligence_run(
        initiative_id="ini_1", run_type="trajectory_comparison", evidence_set_id="evs_1"
    )

    assert FakeHttpClient.calls[0][0:2] == (
        "GET", "https://app.example.test/api/v1/ai-system-assets?asset_type=agent&limit=25"
    )
    assert FakeHttpClient.calls[1][0:2] == ("POST", "https://app.example.test/api/v1/evidence-sets")
    assert FakeHttpClient.calls[2][0:2] == ("POST", "https://app.example.test/api/v1/intelligence-runs")


def test_context_asset_draft_and_activation_are_separate(monkeypatch):
    FakeHttpClient.calls = []
    monkeypatch.setattr(httpx, "Client", FakeHttpClient)
    client = TuningClient(api_key="sk-te-inference-test", api_url="https://app.example.test")

    client.create_context_asset_draft({"name": "Runbook", "context_type": "procedure"})
    client.activate_context_asset("ctx_1", version_id="ctxv_1")

    assert FakeHttpClient.calls[0][0:2] == ("POST", "https://app.example.test/api/v1/context-assets")
    assert FakeHttpClient.calls[1][0:2] == (
        "POST", "https://app.example.test/api/v1/context-assets/ctx_1/activate"
    )
