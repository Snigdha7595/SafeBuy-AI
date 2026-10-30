import json
from app.services import llm
from conftest import GOOD

def test_demo_mode_without_key_is_labeled(client):
    r = client.post("/api/analyze", json=GOOD).json()
    assert r["mode"] == "demo-rules" and any("rule-based" in n for n in r["notes"])
    assert r["affordability"]["remainingCents"] == 32100

def test_health_reports_demo_mode(client):
    h = client.get("/api/health").json()
    assert h["aiMode"] == "demo" and h["paypalConfigured"] is False

def test_insufficient_evidence_is_inconclusive(client):
    body = {"listing": {"name": "Thing", "category": "Misc", "price": "10"}, "budget": {"available": "100"}}
    r = client.post("/api/analyze", json=body).json()
    assert r["assessment"] == "Insufficient information to assess"

def test_low_price_alone_is_not_called_fraud(client):
    body = json.loads(json.dumps(GOOD)); body["listing"]["price"] = "20.00"
    r = client.post("/api/analyze", json=body).json()
    f = [x for x in r["findings"] if "below" in x["title"]]
    assert f and f[0]["severity"] == "low" and "not a sign of fraud" in r["priceContext"]["note"]

def test_invalid_inputs_rejected_with_422(client):
    for patch in ({"listing": {**GOOD["listing"], "price": "-1"}}, {"listing": {**GOOD["listing"], "price": "abc"}},
                  {"budget": {"available": "-5"}}, {"listing": {**GOOD["listing"], "url": "javascript:alert(1)"}},
                  {"listing": {**GOOD["listing"], "currency": "XXX"}}):
        assert client.post("/api/analyze", json={**GOOD, **patch}).status_code == 422

def test_live_mode_uses_validated_llm_output(client, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test")
    good = {"assessment": "Some details require verification", "summary": "One thing to check.", "missing_information": [], "next_step": "Ask about returns.",
            "findings": [{"title": "Urgency wording", "severity": "medium", "confidence": "medium", "basis": "observed", "observed": "Urgency language",
                          "evidence_quote": "only 3 left", "why_it_matters": "Rushing.", "verify": "Slow down."}]}
    async def fake(_): return json.dumps(good)
    monkeypatch.setattr(llm, "call_llm", fake)
    r = client.post("/api/analyze", json=GOOD).json()
    assert r["mode"] == "llm" and r["findings"][0]["source"].startswith("Listing text")
    assert r["affordability"]["remainingCents"] == 32100  # budget math never comes from the model

def test_llm_failure_falls_back_to_rules_with_notice(client, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test")
    async def boom(_): raise llm.LLMUnavailable("The AI service timed out")
    monkeypatch.setattr(llm, "call_llm", boom)
    r = client.post("/api/analyze", json=GOOD).json()
    assert r["mode"] == "demo-rules" and any("unavailable" in n for n in r["notes"])

def test_malformed_llm_output_retries_then_falls_back(client, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test"); calls = []
    async def junk(_): calls.append(1); return "sorry, here is prose"
    monkeypatch.setattr(llm, "call_llm", junk)
    r = client.post("/api/analyze", json=GOOD).json()
    assert len(calls) == 2 and r["mode"] == "demo-rules"

def test_rate_limit_on_analyze(client):
    codes = [client.post("/api/analyze", json=GOOD).status_code for _ in range(12)]
    assert codes[:10] == [200] * 10 and codes[10] == 429
