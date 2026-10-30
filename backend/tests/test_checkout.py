import httpx
import pytest
from app.database import transactions as repo
from app.services import paypal
from conftest import paypal_order

BODY = {"productId": "hp-1", "approved": True}

def make_order(client, **extra):
    r = client.post("/api/checkout/orders", json={**BODY, **extra})
    assert r.status_code == 200, r.text
    return r.json()

# ---------- configuration & approval ----------
def test_unconfigured_returns_503_and_creates_nothing(client, monkeypatch):
    for k in ("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"): monkeypatch.delenv(k, raising=False)
    assert client.get("/api/paypal/config").json() == {"configured": False, "clientId": None, "environment": "sandbox", "currency": "USD", "webhookConfigured": False}
    assert client.post("/api/checkout/orders", json=BODY).status_code == 503
    assert client.get("/api/transactions").json() == []

def test_live_environment_is_refused(client, pp, monkeypatch):
    monkeypatch.setenv("PAYPAL_ENV", "live")
    assert client.get("/api/paypal/config").json()["configured"] is False
    assert client.post("/api/checkout/orders", json=BODY).status_code == 503

def test_explicit_approval_required(client, pp):
    assert client.post("/api/checkout/orders", json={"productId": "hp-1"}).status_code == 422
    assert client.post("/api/checkout/orders", json={"productId": "hp-1", "approved": False}).status_code == 422
    assert pp.created == []

def test_secret_never_exposed(client, pp):
    assert "test-secret-do-not-leak" not in client.get("/api/paypal/config").text
    assert client.get("/api/paypal/config").json()["clientId"] == "test-client"

# ---------- product & amount validation ----------
def test_unknown_product_rejected(client, pp):
    assert client.post("/api/checkout/orders", json={"productId": "nope", "approved": True}).status_code == 404

def test_client_cannot_set_the_price(client, pp):
    make_order(client, amount="0.01", currency="EUR", price="0.01")
    assert str(pp.created[0]["amount"]) == "129.00" and pp.created[0]["currency"] == "USD"
    assert client.get("/api/transactions").json()[0]["amount"] == "129.00"

def test_budget_impact_recorded_from_server_math(client, pp):
    make_order(client, available="500", existing="50")
    assert client.get("/api/transactions").json()[0]["budgetRemainingCents"] == 32100

# ---------- capture & verification ----------
def test_unknown_order_cannot_be_captured(client, pp):
    assert client.post("/api/checkout/orders/FAKE/capture").status_code == 404 and pp.captured == []

def test_successful_capture_is_recorded_as_completed(client, pp):
    make_order(client); pp.capture_result = paypal_order()
    tx = client.post("/api/checkout/orders/ORDER123/capture").json()
    assert tx["status"] == "COMPLETED" and tx["captureId"] == "CAP1"
    assert [t["status"] for t in client.get("/api/transactions").json()] == ["COMPLETED"]

def test_amount_mismatch_never_completes(client, pp):
    make_order(client); pp.capture_result = paypal_order(value="1.00")
    tx = client.post("/api/checkout/orders/ORDER123/capture").json()
    assert tx["status"] == "FAILED" and "did not match" in tx["failureReason"]

def test_currency_mismatch_never_completes(client, pp):
    make_order(client); pp.capture_result = paypal_order(cur="EUR")
    assert client.post("/api/checkout/orders/ORDER123/capture").json()["status"] == "FAILED"

def test_wrong_order_id_in_response_never_completes(client, pp):
    make_order(client); pp.capture_result = paypal_order(oid="OTHER")
    assert client.post("/api/checkout/orders/ORDER123/capture").json()["status"] == "FAILED"

def test_capture_is_idempotent(client, pp):
    make_order(client); pp.capture_result = paypal_order()
    client.post("/api/checkout/orders/ORDER123/capture"); client.post("/api/checkout/orders/ORDER123/capture")
    assert pp.captured == ["ORDER123"]

def test_declined_payment_is_failed(client, pp):
    make_order(client); pp.capture_result = paypal.PayPalError("Payment method declined", name="INSTRUMENT_DECLINED")
    tx = client.post("/api/checkout/orders/ORDER123/capture").json()
    assert tx["status"] == "FAILED" and "declined" in tx["failureReason"]

def test_pending_then_refresh_to_completed(client, pp):
    make_order(client); pp.capture_result = paypal_order(cap_status="PENDING")
    assert client.post("/api/checkout/orders/ORDER123/capture").json()["status"] == "PENDING"
    pp.get_result = paypal_order()
    assert client.post("/api/checkout/orders/ORDER123/refresh").json()["status"] == "COMPLETED"

def test_network_error_reconciles_with_paypal(client, pp):
    make_order(client); pp.capture_result = paypal.PayPalError("timeout", name="NETWORK", retryable=True); pp.get_result = paypal_order()
    assert client.post("/api/checkout/orders/ORDER123/capture").json()["status"] == "COMPLETED"

def test_unconfirmable_payment_is_not_marked_complete(client, pp):
    make_order(client)
    pp.capture_result = paypal.PayPalError("timeout", name="NETWORK", retryable=True); pp.get_result = paypal.PayPalError("down", name="NETWORK", retryable=True)
    assert client.post("/api/checkout/orders/ORDER123/capture").status_code == 502
    assert client.get("/api/transactions").json()[0]["status"] == "CREATED"

def test_cancel_only_affects_created(client, pp):
    make_order(client)
    assert client.post("/api/checkout/orders/ORDER123/cancel").json()["status"] == "CANCELLED"
    make_order_2 = repo.create(order_id="O2", product_id="hp-1", product_name="x", amount="1.00", currency="USD", analysis_id=None, budget_remaining_cents=None)
    repo.transition(make_order_2["id"], "COMPLETED")
    assert client.post("/api/checkout/orders/O2/cancel").json()["status"] == "COMPLETED"

# ---------- state machine & separation of demo data ----------
@pytest.mark.parametrize("a,b", [("COMPLETED", "FAILED"), ("FAILED", "COMPLETED"), ("CANCELLED", "COMPLETED"), ("PENDING", "CANCELLED"), ("CREATED", "CREATED")])
def test_invalid_transitions_raise(a, b):
    tx = repo.create(order_id="X", product_id="p", product_name="p", amount="1.00", currency="USD", analysis_id=None, budget_remaining_cents=None)
    if a != "CREATED": repo.transition(tx["id"], a)
    with pytest.raises(repo.InvalidTransition):
        repo.transition(tx["id"], b)

def test_demo_analysis_creates_no_transactions(client):
    client.post("/api/analyze", json={"listing": {"name": "x", "category": "Headphones", "price": "10", "listingText": "some listing text that is long enough here"}, "budget": {"available": "100"}})
    assert client.get("/api/transactions").json() == []

def test_only_verified_captures_are_completed(client, pp):
    make_order(client)
    assert client.get("/api/transactions").json()[0]["status"] == "CREATED"  # approval alone is not a payment

# ---------- the real HTTP layer, against a mock transport ----------
@pytest.mark.asyncio
async def test_http_layer_sends_correct_sandbox_requests(monkeypatch):
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "cid"); monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "sec"); monkeypatch.setenv("PAYPAL_ENV", "sandbox")
    seen = []
    def handler(req: httpx.Request):
        seen.append(req)
        if req.url.path.endswith("/oauth2/token"): return httpx.Response(200, json={"access_token": "tok", "expires_in": 3600})
        return httpx.Response(201, json={"id": "ORD1"})
    monkeypatch.setattr(paypal, "http_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    from decimal import Decimal
    out = await paypal.create_order(amount=Decimal("129.00"), currency="USD", description="Aurora", reference="tx_1")
    assert out["id"] == "ORD1"
    tok, order = seen
    assert str(tok.url) == "https://api-m.sandbox.paypal.com/v1/oauth2/token" and tok.headers["authorization"].startswith("Basic ")
    assert str(order.url) == "https://api-m.sandbox.paypal.com/v2/checkout/orders" and order.headers["authorization"] == "Bearer tok"
    import json
    body = json.loads(order.content)
    assert body["intent"] == "CAPTURE" and body["purchase_units"][0]["amount"] == {"currency_code": "USD", "value": "129.00"}
    assert "paypal-request-id" in order.headers
