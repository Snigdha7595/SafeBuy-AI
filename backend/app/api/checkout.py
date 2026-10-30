import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.config import get_settings
from app.core.ratelimit import RateLimiter
from app.database import transactions as repo
from app.schemas.checkout import CheckoutConfig, CheckoutRequest, OrderCreated, TransactionOut
from app.services import paypal
from app.services.affordability import compute_affordability
from app.services.catalog import get_product, load_catalog
from app.services.money import parse_money

router = APIRouter(prefix="/api")
_limiter = RateLimiter(max_calls=20, window_seconds=60)
B = {"response_model_by_alias": True}


def limit(request: Request) -> None:
    _limiter.check(request.client.host if request.client else "unknown")


def _out(tx: dict) -> TransactionOut:
    return TransactionOut(
        id=tx["id"], paypal_order_id=tx["paypal_order_id"], product_id=tx["product_id"], product_name=tx["product_name"], amount=tx["amount"],
        currency=tx["currency"], status=tx["status"], capture_id=tx["capture_id"], failure_reason=tx["failure_reason"], analysis_id=tx["analysis_id"],
        budget_remaining_cents=tx["budget_remaining_cents"], environment=tx["environment"], created_at=tx["created_at"], updated_at=tx["updated_at"])


@router.get("/paypal/config", response_model=CheckoutConfig, **B)
def config():
    s = get_settings()
    # The client ID is public by design. The secret is never returned.
    return CheckoutConfig(configured=s.paypal_configured, client_id=s.paypal_client_id if s.paypal_configured else None, webhook_configured=bool(s.paypal_webhook_id))


@router.post("/checkout/orders", response_model=OrderCreated, dependencies=[Depends(limit)], **B)
async def create_order(req: CheckoutRequest):
    if not get_settings().paypal_configured:
        raise HTTPException(503, "PayPal Sandbox is not configured on this server. See the README for setup steps.")
    product = get_product(req.product_id)
    if product is None:
        raise HTTPException(404, "Unknown product.")
    amount = parse_money(product.price)
    remaining = None
    if req.available.strip():
        a = compute_affordability(product.price, req.available, req.existing, product.currency, load_catalog())
        remaining = None if a.error else a.remaining_cents
    tx_id = f"tx_{uuid.uuid4().hex[:16]}"
    try:
        order = await paypal.create_order(amount=amount, currency=product.currency, description=product.name, reference=tx_id)
    except paypal.PayPalError as e:
        raise HTTPException(502, f"PayPal could not create the order: {e}")
    tx = repo.create(order_id=order["id"], product_id=product.id, product_name=product.name, amount=f"{amount:.2f}", currency=product.currency,
                     analysis_id=req.analysis_id, budget_remaining_cents=remaining, tx_id=tx_id)
    return OrderCreated(order_id=order["id"], transaction_id=tx["id"], amount=tx["amount"], currency=tx["currency"])


def _apply(tx: dict, order: dict) -> dict:
    v = paypal.verify_order(order, order_id=tx["paypal_order_id"], expected_amount=parse_money(tx["amount"]), expected_currency=tx["currency"])
    if v.status == "CREATED":
        raise HTTPException(409, "PayPal has not captured this payment yet.")
    return repo.transition(tx["id"], v.status, capture_id=v.capture_id, reason=v.reason)


@router.post("/checkout/orders/{order_id}/capture", response_model=TransactionOut, dependencies=[Depends(limit)], **B)
async def capture(order_id: str):
    tx = repo.get_by_order(order_id)
    if tx is None:
        raise HTTPException(404, "Unknown order. Only orders created by this server can be captured.")
    if tx["status"] != repo.CREATED:  # idempotent: never capture twice
        return _out(tx)
    try:
        order = await paypal.capture_order(order_id, request_id=tx["id"])
    except paypal.PayPalError as e:
        if e.retryable or e.name == "ORDER_ALREADY_CAPTURED":  # outcome unknown: ask PayPal what actually happened
            try:
                order = await paypal.get_order(order_id)
            except paypal.PayPalError:
                raise HTTPException(502, "Could not confirm the payment with PayPal. Check Purchase history in a moment.")
        else:
            return _out(repo.transition(tx["id"], repo.FAILED, reason=str(e)))
    return _out(_apply(tx, order))


@router.post("/checkout/orders/{order_id}/refresh", response_model=TransactionOut, dependencies=[Depends(limit)], **B)
async def refresh(order_id: str):
    tx = repo.get_by_order(order_id)
    if tx is None:
        raise HTTPException(404, "Unknown order.")
    if tx["status"] != repo.PENDING:
        return _out(tx)
    try:
        return _out(_apply(tx, await paypal.get_order(order_id)))
    except paypal.PayPalError:
        raise HTTPException(502, "Could not reach PayPal. Try again shortly.")


@router.post("/checkout/orders/{order_id}/cancel", response_model=TransactionOut, **B)
def cancel(order_id: str):
    tx = repo.get_by_order(order_id)
    if tx is None:
        raise HTTPException(404, "Unknown order.")
    return _out(repo.transition(tx["id"], repo.CANCELLED) if tx["status"] == repo.CREATED else tx)


@router.get("/transactions", response_model=list[TransactionOut], **B)
def transactions():
    return [_out(t) for t in repo.list_all()]
