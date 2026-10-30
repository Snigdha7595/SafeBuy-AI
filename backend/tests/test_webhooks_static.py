import json
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.core.static import mount_frontend
from app.database import transactions as repo
from app.services import paypal
from conftest import paypal_order

H = {"paypal-transmission-id": "t1", "paypal-transmission-time": "2026-10-28T00:00:00Z", "paypal-cert-url": "https://api.sandbox.paypal.com/c",
     "paypal-auth-algo": "SHA256withRSA", "paypal-transmission-sig": "sig"}

def event(kind="PAYMENT.CAPTURE.COMPLETED", order="ORDER123"):
    return {"id": "WH-1", "event_type": kind, "resource": {"id": "CAP1", "supplementary_data": {"related_ids": {"order_id": order}}}}

def post(client, ev):
    return client.post("/api/paypal/webhook", content=json.dumps(ev), headers={**H, "content-type": "application/json"})

def pending_tx(client, pp):
    client.post("/api/checkout/orders", json={"productId": "hp-1", "approved": True})
    pp.capture_result = paypal_order(cap_status="PENDING")
    assert client.post("/api/checkout/orders/ORDER123/capture").json()["status"] == "PENDING"

# ---------- webhooks ----------
def test_webhook_503_when_not_configured(client, monkeypatch):
    monkeypatch.delenv("PAYPAL_WEBHOOK_ID", raising=False)
    assert post(client, event()).status_code == 503

def test_bad_signature_rejected_and_changes_nothing(client, pp):
    pending_tx(client, pp); pp.webhook_ok = False; pp.get_result = paypal_order()
    assert post(client, event()).status_code == 400
    assert client.get("/api/transactions").json()[0]["status"] == "PENDING" and pp.fetched == []

def test_completed_event_settles_pending_payment_by_reverifying_with_paypal(client, pp):
    pending_tx(client, pp); pp.get_result = paypal_order()
    assert post(client, event()).json() == {"received": True, "handled": True}
    assert client.get("/api/transactions").json()[0]["status"] == "COMPLETED" and pp.fetched == ["ORDER123"]

def test_event_body_is_not_trusted_for_money(client, pp):
    pending_tx(client, pp); pp.get_result = paypal_order(value="1.00")   # PayPal's own record disagrees with our price
    post(client, event())
    assert client.get("/api/transactions").json()[0]["status"] == "FAILED"

def test_duplicate_delivery_is_idempotent(client, pp):
    pending_tx(client, pp); pp.get_result = paypal_order()
    post(client, event()); assert post(client, event()).status_code == 200
    assert client.get("/api/transactions").json()[0]["status"] == "COMPLETED"

def test_refund_event_marks_completed_payment_refunded(client, pp):
    client.post("/api/checkout/orders", json={"productId": "hp-1", "approved": True}); pp.capture_result = paypal_order()
    client.post("/api/checkout/orders/ORDER123/capture")
    post(client, event("PAYMENT.CAPTURE.REFUNDED"))
    assert client.get("/api/transactions").json()[0]["status"] == "REFUNDED"

def test_refund_does_not_touch_unpaid_orders(client, pp):
    client.post("/api/checkout/orders", json={"productId": "hp-1", "approved": True})
    post(client, event("PAYMENT.CAPTURE.REFUNDED"))
    assert client.get("/api/transactions").json()[0]["status"] == "CREATED"

def test_unknown_order_is_acknowledged_not_errored(client, pp):
    assert post(client, event(order="NOPE")).json()["handled"] is False

def test_unreadable_order_returns_5xx_so_paypal_retries(client, pp):
    pending_tx(client, pp); pp.get_result = paypal.PayPalError("down", name="NETWORK", retryable=True)
    assert post(client, event()).status_code == 502

def test_refunded_is_terminal():
    tx = repo.create(order_id="Z", product_id="p", product_name="p", amount="1.00", currency="USD", analysis_id=None, budget_remaining_cents=None)
    repo.transition(tx["id"], "COMPLETED"); repo.transition(tx["id"], "REFUNDED")
    with pytest.raises(repo.InvalidTransition): repo.transition(tx["id"], "COMPLETED")

@pytest.mark.asyncio
async def test_verify_webhook_forwards_event_bytes_unchanged(monkeypatch):
    for k, v in {"PAYPAL_CLIENT_ID": "c", "PAYPAL_CLIENT_SECRET": "s", "PAYPAL_ENV": "sandbox", "PAYPAL_WEBHOOK_ID": "WH9"}.items(): monkeypatch.setenv(k, v)
    seen = []
    def handler(req):
        seen.append(req)
        return httpx.Response(200, json={"access_token": "t", "expires_in": 3600}) if req.url.path.endswith("/token") else httpx.Response(200, json={"verification_status": "SUCCESS"})
    monkeypatch.setattr(paypal, "http_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    raw = b'{"z":1,"a":{"b":2}}'   # deliberately unsorted
    assert await paypal.verify_webhook(H, raw) is True
    sent = seen[-1].content.decode()
    assert sent.endswith('"webhook_event":{"z":1,"a":{"b":2}}}') and json.loads(sent)["webhook_id"] == "WH9"
    assert str(seen[-1].url).endswith("/v1/notifications/verify-webhook-signature")

@pytest.mark.asyncio
async def test_verify_webhook_false_without_headers_or_id(monkeypatch):
    monkeypatch.setenv("PAYPAL_WEBHOOK_ID", "")
    assert await paypal.verify_webhook(H, b"{}") is False

# ---------- static frontend hosting ----------
def test_spa_hosting_serves_index_assets_and_keeps_api_404s_json(tmp_path):
    (tmp_path / "assets").mkdir(); (tmp_path / "assets" / "a.js").write_text("x=1"); (tmp_path / "index.html").write_text("<html>SPA</html>")
    (tmp_path.parent / "secret.txt").write_text("nope")
    app = FastAPI(); assert mount_frontend(app, tmp_path); c = TestClient(app)
    assert "SPA" in c.get("/").text and "SPA" in c.get("/app/history").text
    assert c.get("/assets/a.js").text == "x=1"
    assert c.get("/api/unknown").status_code == 404
    assert "nope" not in c.get("/../secret.txt").text and "nope" not in c.get("/%2e%2e/secret.txt").text

def test_no_dist_means_no_mount(tmp_path):
    assert mount_frontend(FastAPI(), tmp_path) is False
