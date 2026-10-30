from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

CENT = Decimal("0.01")
MAX_AMOUNT = Decimal("100000000")


def parse_money(value: str | int | Decimal, *, field: str = "amount") -> Decimal:
    """Parse user input into a 2-dp Decimal. Rejects floats-as-text oddities (NaN, inf, exponents), negatives and huge values."""
    s = str(value).strip().replace(",", "")
    if not s or any(c not in "0123456789." for c in s) or s.count(".") > 1:
        raise ValueError(f"{field} must be a plain number like 129.99")
    try:
        d = Decimal(s)
    except InvalidOperation:
        raise ValueError(f"{field} must be a plain number like 129.99")
    if d != d.quantize(CENT):
        raise ValueError(f"{field} can have at most 2 decimal places")
    if d > MAX_AMOUNT:
        raise ValueError(f"{field} is too large")
    return d.quantize(CENT, rounding=ROUND_HALF_UP)


def to_cents(d: Decimal) -> int:
    return int((d * 100).to_integral_value(rounding=ROUND_HALF_UP))


def fmt(d: Decimal, currency: str) -> str:
    return f"{currency} {d:,.2f}"
