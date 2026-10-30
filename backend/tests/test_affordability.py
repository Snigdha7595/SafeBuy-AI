import pytest
from app.services.affordability import compute_affordability
from app.services.catalog import load_catalog
from app.services.money import parse_money

C = load_catalog()
def calc(p, a, e="", cur="USD", ex=None): return compute_affordability(p, a, e, cur, C, ex)


def test_basic_math_is_exact():
    r = calc("129.00", "500", "50")
    assert (r.budget_cents, r.remaining_cents, r.percent_used, r.fits) == (45000, 32100, 28.7, True)

def test_no_float_drift():
    assert calc("0.10", "0.30").remaining_cents == 20  # 0.30 - 0.10 exactly
    assert calc("0.20", "0.30", "0.10").remaining_cents == 0 and calc("0.20", "0.30", "0.10").fits

def test_over_budget_reports_shortfall():
    r = calc("349.00", "200")
    assert not r.fits and r.shortfall_cents == 14900 and r.remaining_cents == -14900

def test_zero_budget():
    r = calc("10.00", "0")
    assert not r.fits and r.percent_used == 100.0 and r.shortfall_cents == 1000

def test_existing_spending_exceeding_budget_floors_at_zero():
    assert calc("10", "100", "150").budget_cents == 0

@pytest.mark.parametrize("price", ["-5", "0", "abc", "", "1e3", "NaN", "inf", "12.345", "1.2.3", "99999999999"])
def test_invalid_price_rejected(price):
    assert calc(price, "100").error

@pytest.mark.parametrize("bad", ["-1", "x", "1e2"])
def test_invalid_budget_and_existing_rejected(bad):
    assert calc("10", bad).error and calc("10", "100", bad).error

def test_alternatives_are_cheaper_in_budget_same_currency():
    r = calc("349.00", "200", ex="mon-1")
    assert r.alternatives and all(parse_money(a.price) < 349 and parse_money(a.price) <= 200 and a.id != "mon-1" for a in r.alternatives)

def test_currency_mismatch_gives_no_alternatives():
    assert calc("349.00", "400", cur="EUR").alternatives == []
