"""Deterministic, rule-based checks. Used for demo mode, for the facts shown beside AI output
(seller transparency, price context), and as the fallback when the LLM is unavailable."""
import re
from decimal import Decimal

from app.schemas.analysis import Assessment, CatalogProduct, Finding, Listing, PriceContext, SellerItem
from app.services.money import fmt, parse_money

PRESSURE = re.compile(r"(limited time|only \d+ left|act now|hurry|today only|price rises|last chance|selling fast)", re.I)
VAGUE_RETURN = re.compile(r"^(see (website|site)|contact us|n/?a|tbd|varies)\.?$", re.I)


def _return_status(text: str) -> str:
    t = text.strip()
    return "missing" if not t else "unclear" if VAGUE_RETURN.match(t) or len(t) < 12 else "present"


def seller_transparency(l: Listing) -> list[SellerItem]:
    has_seller, has_warranty, rs = len(l.seller.strip()) > 1, len(l.warranty.strip()) > 3, _return_status(l.return_policy)
    return [
        SellerItem(label="Seller name", status="present" if has_seller else "missing",
                   note=f"{l.seller} (not independently verified)" if has_seller else "Not provided"),
        SellerItem(label="Return policy", status=rs, note=l.return_policy.strip() or "Not provided"),
        SellerItem(label="Warranty", status="present" if has_warranty else "missing", note=l.warranty.strip() or "Not provided"),
    ]


def price_context(l: Listing, catalog, catalog_id: str | None) -> tuple[PriceContext, Decimal | None]:
    price = parse_money(l.price)
    comps = [c for c in catalog if c.category.lower() == l.category.strip().lower() and c.id != catalog_id and c.currency == l.currency]
    if not comps:
        return PriceContext(basis="No demo catalog products in this category.", comparable_count=0,
                            note="No price comparison is possible, so none is drawn."), None
    prices = sorted(parse_money(c.price) for c in comps)
    med = prices[len(prices) // 2]
    plural = "s" if len(comps) > 1 else ""
    note = ("This price is well below the catalog median. That can have innocent causes (older model, different spec), so it's a prompt to compare specs, not a sign of fraud."
            if price < med / 2 else "This price is well above the catalog median." if price > med * Decimal("1.5")
            else "This price is within a normal range of the comparison products.")
    return PriceContext(basis=f"{len(comps)} demo catalog product{plural} in \"{l.category}\" (median {fmt(med, l.currency)}).",
                        comparable_count=len(comps), note=note), (med if price < med / 2 else None)


def observed_facts(l: Listing) -> list[str]:
    rs = _return_status(l.return_policy)
    return [f"Listed at {fmt(parse_money(l.price), l.currency)} in {l.category}.",
            f"Seller named: {l.seller}." if l.seller.strip() else "No seller named.",
            f"Warranty stated: {l.warranty.strip()}" if len(l.warranty.strip()) > 3 else "No warranty stated.",
            f"Returns: {l.return_policy.strip()}" if rs == "present" else "Return terms missing or unclear."]


def is_insufficient(l: Listing) -> bool:
    return len((l.description + l.listing_text).strip()) < 40 and not l.seller.strip() and _return_status(l.return_policy) == "missing"


def rule_findings(l: Listing, low_price_median: Decimal | None) -> tuple[list[Finding], list[str]]:
    out: list[Finding] = []
    missing: list[str] = []

    def add(**kw):
        out.append(Finding(id=f"f{len(out) + 1}", **kw))

    text = f"{l.description}\n{l.listing_text}"
    rs = _return_status(l.return_policy)
    if len(l.seller.strip()) <= 1:
        missing.append("Seller name")
        add(title="No seller identified", severity="medium", confidence="high", observed="The submitted listing has no seller name.",
            source="Seller field is empty", why_it_matters="Without a seller name you can't look up their history or contact them if something goes wrong.",
            verify="Find the seller's name and contact details on the platform before paying.")
    if rs != "present":
        missing.append("Clear return terms")
        add(title="Return policy not stated" if rs == "missing" else "Return policy is unclear", severity="medium", confidence="high",
            observed="No return or refund terms were supplied." if rs == "missing" else f'The return field says only "{l.return_policy.strip()}".',
            source="Return policy field", why_it_matters="You can't tell how to get your money back if the item isn't as described.",
            verify="Ask for the return window, who pays return shipping, and the refund method, in writing.")
    if len(l.warranty.strip()) <= 3:
        missing.append("Warranty details")
        add(title="No warranty details", severity="low", confidence="high", observed="No warranty information was supplied.",
            source="Warranty field is empty", why_it_matters="Repairs or replacements after the return window may not be covered.",
            verify="Ask what the warranty covers, how long it lasts, and who honors it.")
    if m := PRESSURE.search(text):
        add(title="Urgency language in listing", severity="medium", confidence="medium", observed=f'The listing uses urgency wording: "{m.group(0)}".',
            source="Listing text", why_it_matters="Pressure to buy quickly can discourage checking details. This alone doesn't show bad intent; many honest sellers use it.",
            verify="Ignore the countdown and check the other items in this report first.")
    res = re.search(r"(\d{3,4})\s*x\s*(\d{3,4})", text, re.I)
    if res and re.search(r"\b4k\b", text, re.I) and int(res.group(1)) < 3000:
        add(title="Title and specs disagree", severity="high", confidence="high",
            observed=f'The listing says "4K" but also gives a resolution of {res.group(1)}x{res.group(2)}.', source="Listing text",
            why_it_matters="One of the two claims is wrong. It may be a typo or a misleading title.",
            verify="Ask the seller to confirm the exact resolution, and check the manufacturer's spec sheet.")
    if len(text.strip()) < 40:
        missing.append("A meaningful description")
    if low_price_median is not None:
        add(title="Price well below comparable demo products", severity="low", confidence="low",
            observed=f"{fmt(parse_money(l.price), l.currency)} vs. a catalog median of {fmt(low_price_median, l.currency)}.", source="Demo catalog comparison",
            why_it_matters="Large gaps are worth understanding, but a low price doesn't prove a problem.",
            verify="Compare specs and condition (new, refurbished, older model) against the pricier options.")
    return out, missing


def assess(findings: list[Finding], insufficient: bool) -> Assessment:
    if insufficient:
        return "Insufficient information to assess"
    material = sum(f.severity != "low" for f in findings)
    if material >= 3 or any(f.severity == "high" for f in findings):
        return "Multiple material concerns require attention"
    return "Some details require verification" if findings else "No major concerns identified in the supplied information"
