import pytest
from conftest import GOOD

def set_budget(client, budget="600", spent="215", cur="USD"):
    r = client.put("/api/settings", json={"currency": cur, "monthlyBudget": budget, "spent": spent}); assert r.status_code == 200; return r.json()

def test_unconfigured_defaults(client):
    assert client.get("/api/settings").json()["configured"] is False
    assert client.get("/api/budget/summary").json()["configured"] is False

def test_settings_persist_and_update(client):
    set_budget(client); set_budget(client, "700", "0")
    s = client.get("/api/settings").json()
    assert (s["monthlyBudget"], s["spent"], s["configured"]) == ("700.00", "0.00", True)

@pytest.mark.parametrize("bad", [{"monthlyBudget": "-1"}, {"monthlyBudget": "abc"}, {"monthlyBudget": "10", "spent": "-5"}, {"monthlyBudget": "1e3"}, {"monthlyBudget": "10", "currency": "XXX"}])
def test_invalid_settings_rejected(client, bad):
    assert client.put("/api/settings", json={"currency": "USD", "monthlyBudget": "10", **bad}).status_code == 422

def test_summary_math_is_exact(client):
    set_budget(client, "600", "215.10")
    client.post("/api/planned", json={"name": "Desk", "amount": "189.00"}); client.post("/api/planned", json={"name": "Headphones", "amount": "129.00"})
    s = client.get("/api/budget/summary").json()
    assert (s["spentCents"], s["plannedCents"], s["remainingCents"], s["percentCommitted"]) == (21510, 31800, 6690, 88.9)
    assert [p["name"] for p in s["planned"]] == ["Desk", "Headphones"]

def test_overcommitted_budget_goes_negative_not_hidden(client):
    set_budget(client, "100", "90"); client.post("/api/planned", json={"name": "X", "amount": "50"})
    assert client.get("/api/budget/summary").json()["remainingCents"] == -4000

def test_planned_requires_budget_and_valid_amount(client):
    assert client.post("/api/planned", json={"name": "X", "amount": "10"}).status_code == 409
    set_budget(client)
    for amt in ("0", "-3", "abc"):
        assert client.post("/api/planned", json={"name": "X", "amount": amt}).status_code == 422
    assert client.post("/api/planned", json={"name": "", "amount": "5"}).status_code == 422

def test_delete_planned(client):
    set_budget(client); pid = client.post("/api/planned", json={"name": "X", "amount": "10"}).json()["id"]
    assert client.delete(f"/api/planned/{pid}").status_code == 204
    assert client.delete(f"/api/planned/{pid}").status_code == 404
    assert client.get("/api/budget/summary").json()["plannedCents"] == 0

def test_scenario_counts_spent_and_planned(client):
    set_budget(client, "600", "215"); client.post("/api/planned", json={"name": "Desk", "amount": "189"})
    r = client.post("/api/budget/scenario", json={"price": "129"}).json()
    assert r["budgetCents"] == 60000 - 21500 - 18900 and r["remainingCents"] == 19600 - 12900 and r["fits"]
    over = client.post("/api/budget/scenario", json={"price": "300"}).json()
    assert not over["fits"] and over["shortfallCents"] == 10400

def test_scenario_rejects_bad_input_and_needs_budget(client):
    assert client.post("/api/budget/scenario", json={"price": "10"}).status_code == 409
    set_budget(client)
    assert client.post("/api/budget/scenario", json={"price": "-1"}).status_code == 422

def test_currency_change_blocked_while_planned_items_exist(client):
    set_budget(client); client.post("/api/planned", json={"name": "X", "amount": "10"})
    assert client.put("/api/settings", json={"currency": "EUR", "monthlyBudget": "600"}).status_code == 409

def test_analysis_save_roundtrip_and_delete(client):
    rep = client.post("/api/analyze", json=GOOD).json()
    assert client.post("/api/analyses", json=rep).status_code == 200
    assert client.get("/api/analyses").json()[0]["id"] == rep["id"]
    got = client.get(f"/api/analyses/{rep['id']}").json()
    assert got["assessment"] == rep["assessment"] and got["affordability"]["remainingCents"] == 32100
    assert client.delete(f"/api/analyses/{rep['id']}").status_code == 204
    assert client.get(f"/api/analyses/{rep['id']}").status_code == 404

def test_saving_same_analysis_twice_does_not_duplicate(client):
    rep = client.post("/api/analyze", json=GOOD).json()
    client.post("/api/analyses", json=rep); client.post("/api/analyses", json=rep)
    assert len(client.get("/api/analyses").json()) == 1

def test_malformed_analysis_payload_rejected(client):
    assert client.post("/api/analyses", json={"id": "x"}).status_code == 422

def test_history_links_to_saved_analysis(client, pp):
    from conftest import paypal_order
    rep = client.post("/api/analyze", json=GOOD).json(); client.post("/api/analyses", json=rep)
    client.post("/api/checkout/orders", json={"productId": "hp-1", "approved": True, "analysisId": rep["id"], "available": "500"})
    pp.capture_result = paypal_order(); client.post("/api/checkout/orders/ORDER123/capture")
    tx = client.get("/api/transactions").json()[0]
    assert tx["analysisId"] == rep["id"] and tx["status"] == "COMPLETED"
    assert client.get(f"/api/analyses/{tx['analysisId']}").status_code == 200
