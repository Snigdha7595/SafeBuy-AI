"""PayPal webhooks: lets payments settle even if the browser closes mid-checkout (PENDING -> COMPLETED, refunds).
Security: (1) the signature is verified by PayPal's API, (2) we never trust the event body for money facts.
We re-fetch the order from PayPal and run the same verification used for captures."""
import json
import logging

from fastapi import APIRouter, HTTPException, Request

from app.core.config import get_settings
from app.database import transactions as repo
from app.services import paypal
from app.services.money import parse_money

router = APIRouter(prefix="/api")
log = logging.getLogger("safebuy.webhook")
SETTLE = {"PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.PENDING", "PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.DECLINED"}
REVERSE = {"PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"}


def _find_tx(event: dict) -> dict | None:
    res = event.get("resource") or {}
    related = (res.get("supplementary_data") or {}).get("related_ids") or {}
    if related.get("order_id") and (tx := repo.get_by_order(related["order_id"])):
        return tx
    for cid in (related.get("capture_id"), res.get("id")):
        if cid and (tx := repo.get_by_capture(cid)):
            return tx
    return None


@router.post("/paypal/webhook")
async def paypal_webhook(request: Request):
    raw = await request.body()
    s = get_settings()
    if not (s.paypal_configured and s.paypal_webhook_id):
        raise HTTPException(503, "Webhooks are not configured.")
    try:
        valid = await paypal.verify_webhook(request.headers, raw)
    except paypal.PayPalError:
        raise HTTPException(502, "Could not verify the webhook right now.")  # non-2xx makes PayPal retry later
    if not valid:
        raise HTTPException(400, "Invalid webhook signature.")
    try:
        event = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "Malformed event.")

    etype, tx = event.get("event_type"), _find_tx(event)
    if tx is None:  # not one of ours, or unrelated event: acknowledge so PayPal stops retrying
        return {"received": True, "handled": False}
    try:
        if etype in SETTLE and tx["status"] in (repo.CREATED, repo.PENDING):
            try:
                order = await paypal.get_order(tx["paypal_order_id"])
            except paypal.PayPalError:
                raise HTTPException(502, "Could not read the order from PayPal.")
            v = paypal.verify_order(order, order_id=tx["paypal_order_id"], expected_amount=parse_money(tx["amount"]), expected_currency=tx["currency"])
            if v.status not in ("CREATED", tx["status"]):
                repo.transition(tx["id"], v.status, capture_id=v.capture_id, reason=v.reason)
        elif etype in REVERSE and tx["status"] == repo.COMPLETED:
            repo.transition(tx["id"], repo.REFUNDED, reason="Refunded or reversed in PayPal.")
    except repo.InvalidTransition:
        log.info("Ignored out-of-order webhook %s for %s", etype, tx["id"])  # duplicate or late delivery
    return {"received": True, "handled": True}
