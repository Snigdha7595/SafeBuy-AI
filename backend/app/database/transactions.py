"""SQLite data-access layer for sandbox transactions. Swap this module to change databases."""
import uuid
from datetime import datetime, timezone

from app.database.core import conn

CREATED, PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED = "CREATED", "PENDING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED"
ALLOWED = {CREATED: {PENDING, COMPLETED, FAILED, CANCELLED}, PENDING: {COMPLETED, FAILED}, COMPLETED: {REFUNDED}, FAILED: set(), CANCELLED: set(), REFUNDED: set()}

class InvalidTransition(Exception):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create(*, order_id: str, product_id: str, product_name: str, amount: str, currency: str,
           analysis_id: str | None, budget_remaining_cents: int | None, tx_id: str | None = None) -> dict:
    tx_id = tx_id or f"tx_{uuid.uuid4().hex[:16]}"
    now = _now()
    with conn() as c:
        c.execute("INSERT INTO transactions (id, paypal_order_id, product_id, product_name, amount, currency, status, analysis_id, budget_remaining_cents, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                  (tx_id, order_id, product_id, product_name, amount, currency, CREATED, analysis_id, budget_remaining_cents, now, now))
    return get(tx_id)  # type: ignore[return-value]


def get(tx_id: str) -> dict | None:
    with conn() as c:
        r = c.execute("SELECT * FROM transactions WHERE id=?", (tx_id,)).fetchone()
    return dict(r) if r else None


def get_by_order(order_id: str) -> dict | None:
    with conn() as c:
        r = c.execute("SELECT * FROM transactions WHERE paypal_order_id=?", (order_id,)).fetchone()
    return dict(r) if r else None


def get_by_capture(capture_id: str) -> dict | None:
    with conn() as c:
        r = c.execute("SELECT * FROM transactions WHERE capture_id=?", (capture_id,)).fetchone()
    return dict(r) if r else None


def transition(tx_id: str, new_status: str, *, capture_id: str | None = None, reason: str | None = None) -> dict:
    tx = get(tx_id)
    if tx is None:
        raise KeyError(tx_id)
    if new_status not in ALLOWED.get(tx["status"], set()):
        raise InvalidTransition(f"{tx['status']} -> {new_status} is not allowed")
    with conn() as c:
        c.execute("UPDATE transactions SET status=?, capture_id=COALESCE(?, capture_id), failure_reason=?, updated_at=? WHERE id=?",
                  (new_status, capture_id, reason, _now(), tx_id))
    return get(tx_id)  # type: ignore[return-value]


def list_all(limit: int = 100) -> list[dict]:
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?", (limit,))]
