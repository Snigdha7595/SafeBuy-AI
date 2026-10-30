from decimal import Decimal, ROUND_HALF_UP

from app.schemas.analysis import Affordability, CatalogProduct
from app.services.money import parse_money, to_cents

ZERO = Decimal("0")


def compute_affordability(price: str, available: str, existing: str, currency: str,
                          catalog: tuple[CatalogProduct, ...] | list[CatalogProduct], exclude_id: str | None = None) -> Affordability:
    """Authoritative budget math. Decimal only; the LLM never produces these numbers."""
    try:
        p = parse_money(price, field="price")
        a = parse_money(available, field="available budget")
        e = parse_money(existing, field="existing spending") if existing.strip() else ZERO
    except ValueError as exc:
        return Affordability(error=str(exc))
    if p <= 0:
        return Affordability(error="price must be greater than zero")

    budget = max(a - e, ZERO)
    remaining = budget - p
    pct = Decimal("100.0") if budget == 0 else (p * 100 / budget).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    # Only same-currency, cheaper-than-this, within-budget items: no cross-currency guessing.
    alts = [c for c in catalog if c.id != exclude_id and c.currency == currency
            and parse_money(c.price) < p and parse_money(c.price) <= budget]
    return Affordability(
        price_cents=to_cents(p), budget_cents=to_cents(budget), remaining_cents=to_cents(remaining),
        percent_used=float(pct), fits=remaining >= 0, shortfall_cents=to_cents(-remaining) if remaining < 0 else 0,
        alternatives=alts,
    )
