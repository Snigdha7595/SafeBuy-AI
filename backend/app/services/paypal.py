"""PayPal Orders v2 (Sandbox only). All calls happen server-side so the secret never reaches the browser.
Flow: create order (intent CAPTURE) -> buyer approves in the JS SDK -> server captures -> server verifies."""
import base64
import json as jsonlib
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

import httpx

from app.core.config import get_settings

SANDBOX_BASE = "https://api-m.sandbox.paypal.com"
_token: dict = {"value": None, "exp": 0.0}


class PayPalError(Exception):
    def __init__(self, message: str, *, name: str | None = None, retryable: bool = False):
        super().__init__(message)
        self.name, self.retryable = name, retryable


def http_client() -> httpx.AsyncClient:  # tests replace this with a MockTransport client
    return httpx.AsyncClient(timeout=20.0)


def reset_token_cache() -> None:
    _token.update(value=None, exp=0.0)


async def _request(method: str, path: str, *, json: dict | None = None, request_id: str | None = None, raw: str | None = None) -> dict:
    s = get_settings()
    if not s.paypal_configured:
        raise PayPalError("PayPal Sandbox credentials are not configured.", name="NOT_CONFIGURED")
    try:
        async with http_client() as c:
            if _token["value"] is None or time.time() > _token["exp"] - 60:
                basic = base64.b64encode(f"{s.paypal_client_id}:{s.paypal_client_secret}".encode()).decode()
                t = await c.post(f"{SANDBOX_BASE}/v1/oauth2/token", data={"grant_type": "client_credentials"}, headers={"Authorization": f"Basic {basic}"})
                if t.status_code != 200:
                    raise PayPalError("PayPal rejected the Sandbox credentials.", name="AUTH_FAILED")
                _token.update(value=t.json()["access_token"], exp=time.time() + int(t.json().get("expires_in", 300)))
            headers = {"Authorization": f"Bearer {_token['value']}", "Content-Type": "application/json"}
            if request_id:
                headers["PayPal-Request-Id"] = request_id  # idempotency key
            body = {"content": raw.encode()} if raw is not None else {"json": json}
            r = await c.request(method, f"{SANDBOX_BASE}{path}", headers=headers, **body)
    except (httpx.TimeoutException, httpx.TransportError) as e:
        raise PayPalError("Could not reach PayPal.", name="NETWORK", retryable=True) from e
    if r.status_code >= 500:
        raise PayPalError("PayPal had a temporary problem.", name="PAYPAL_5XX", retryable=True)
    body = r.json() if r.content else {}
    if r.status_code >= 400:
        details = body.get("details") or [{}]
        name = details[0].get("issue") or body.get("name")
        raise PayPalError(details[0].get("description") or body.get("message") or "PayPal declined the request.", name=name)
    return body


async def create_order(*, amount: Decimal, currency: str, description: str, reference: str) -> dict:
    return await _request("POST", "/v2/checkout/orders", request_id=f"create-{reference}", json={
        "intent": "CAPTURE",
        "purchase_units": [{"reference_id": reference, "custom_id": reference, "description": description[:120],
                            "amount": {"currency_code": currency, "value": f"{amount:.2f}"}}],
    })


async def capture_order(order_id: str, *, request_id: str) -> dict:
    return await _request("POST", f"/v2/checkout/orders/{order_id}/capture", request_id=f"capture-{request_id}", json={})


async def get_order(order_id: str) -> dict:
    return await _request("GET", f"/v2/checkout/orders/{order_id}")


async def verify_webhook(headers, raw_body: bytes) -> bool:
    """Ask PayPal to verify a webhook's signature. The event must be forwarded byte-for-byte: re-serializing it
    changes field order and PayPal then reports FAILURE."""
    h = {k.lower(): v for k, v in headers.items()}
    names = ["paypal-transmission-id", "paypal-transmission-time", "paypal-cert-url", "paypal-auth-algo", "paypal-transmission-sig"]
    webhook_id = get_settings().paypal_webhook_id
    if not webhook_id or any(n not in h for n in names):
        return False
    d = jsonlib.dumps
    body = ('{"transmission_id":%s,"transmission_time":%s,"cert_url":%s,"auth_algo":%s,"transmission_sig":%s,"webhook_id":%s,"webhook_event":%s}'
            % (d(h[names[0]]), d(h[names[1]]), d(h[names[2]]), d(h[names[3]]), d(h[names[4]]), d(webhook_id), raw_body.decode()))
    out = await _request("POST", "/v1/notifications/verify-webhook-signature", raw=body)
    return out.get("verification_status") == "SUCCESS"


@dataclass(frozen=True)
class Verification:
    status: str  # COMPLETED | PENDING | FAILED | CREATED (= not captured yet)
    capture_id: str | None = None
    reason: str | None = None


def verify_order(order: dict, *, order_id: str, expected_amount: Decimal, expected_currency: str) -> Verification:
    """Trust nothing: the order id, amount, currency and capture status must all match what WE stored."""
    if order.get("id") != order_id:
        return Verification("FAILED", reason="PayPal returned a different order than expected.")
    if order.get("status") in ("CREATED", "APPROVED", "SAVED", "PAYER_ACTION_REQUIRED"):
        return Verification("CREATED")
    units = order.get("purchase_units") or []
    caps = ((units[0].get("payments") or {}).get("captures") or []) if units else []
    if not caps:
        return Verification("FAILED", reason="No capture was found on the PayPal order.")
    cap = caps[0]
    amt = cap.get("amount") or {}
    try:
        paid = Decimal(str(amt.get("value")))
    except (InvalidOperation, TypeError):
        return Verification("FAILED", capture_id=cap.get("id"), reason="Captured amount was missing or unreadable.")
    if amt.get("currency_code") != expected_currency or paid != expected_amount:
        return Verification("FAILED", capture_id=cap.get("id"), reason="Captured amount or currency did not match the product price.")
    cs = cap.get("status")
    if cs == "COMPLETED" and order.get("status") == "COMPLETED":
        return Verification("COMPLETED", capture_id=cap.get("id"))
    if cs == "PENDING":
        return Verification("PENDING", capture_id=cap.get("id"), reason=(cap.get("status_details") or {}).get("reason"))
    return Verification("FAILED", capture_id=cap.get("id"), reason=f"Payment status: {cs or 'unknown'}.")
