import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.core.ratelimit import analyze_limiter
from app.main import app


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    analyze_limiter.reset()


@pytest.fixture
def client():
    return TestClient(app)


GOOD = {"listing": {"name": "Aurora ANC Headphones", "category": "Headphones", "price": "129.00", "seller": "Northwind Audio",
                    "listingText": "Over-ear wireless headphones. 30-day returns. Hurry, only 3 left!", "returnPolicy": "30-day returns, buyer pays shipping.",
                    "warranty": "1-year limited warranty."},
        "budget": {"available": "500", "existing": "50"}}


@pytest.fixture(autouse=True)
def _tmp_db(monkeypatch, tmp_path):
    monkeypatch.setenv("SAFEBUY_DB", str(tmp_path / "test.db"))
    from app.api import checkout
    from app.services import paypal
    checkout._limiter.reset()
    paypal.reset_token_cache()


@pytest.fixture
def pp(monkeypatch):
    """Configured sandbox credentials + a scriptable fake PayPal."""
    from app.services import paypal
    monkeypatch.setenv("PAYPAL_CLIENT_ID", "test-client")
    monkeypatch.setenv("PAYPAL_CLIENT_SECRET", "test-secret-do-not-leak")
    monkeypatch.setenv("PAYPAL_ENV", "sandbox")
    monkeypatch.setenv("PAYPAL_WEBHOOK_ID", "WH123")

    class Fake:
        created, captured, fetched = [], [], []
        capture_result = None   # dict or Exception
        get_result = None
        webhook_ok = True

    f = Fake(); f.created, f.captured, f.fetched = [], [], []

    async def create_order(**kw):
        f.created.append(kw); return {"id": "ORDER123", "status": "CREATED"}
    async def capture_order(order_id, *, request_id):
        f.captured.append(order_id)
        if isinstance(f.capture_result, Exception): raise f.capture_result
        return f.capture_result
    async def get_order(order_id):
        f.fetched.append(order_id)
        if isinstance(f.get_result, Exception): raise f.get_result
        return f.get_result
    async def verify_webhook(headers, body):
        return f.webhook_ok
    monkeypatch.setattr(paypal, "verify_webhook", verify_webhook)
    monkeypatch.setattr(paypal, "create_order", create_order)
    monkeypatch.setattr(paypal, "capture_order", capture_order)
    monkeypatch.setattr(paypal, "get_order", get_order)
    return f


def paypal_order(*, oid="ORDER123", value="129.00", cur="USD", cap_status="COMPLETED", order_status="COMPLETED"):
    return {"id": oid, "status": order_status, "purchase_units": [{"payments": {"captures": [
        {"id": "CAP1", "status": cap_status, "amount": {"currency_code": cur, "value": value}}]}}]}
