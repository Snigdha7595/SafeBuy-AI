from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, HTTPException

from app.database import planner as repo
from app.schemas.analysis import Affordability, Report
from app.schemas.planner import BudgetSummary, PlannedIn, PlannedOut, SavedItem, ScenarioIn, SettingsIn, SettingsOut
from app.services.affordability import compute_affordability
from app.services.catalog import load_catalog
from app.services.money import parse_money, to_cents

router = APIRouter(prefix="/api")
B = {"response_model_by_alias": True}
ZERO = Decimal("0")


def _settings() -> dict | None:
    return repo.get_settings()


@router.get("/settings", response_model=SettingsOut, **B)
def get_settings():
    s = _settings()
    return SettingsOut(configured=True, currency=s["currency"], monthly_budget=s["monthly_budget"], spent=s["spent"]) if s else SettingsOut(configured=False)


@router.put("/settings", response_model=SettingsOut, **B)
def put_settings(body: SettingsIn):
    old = _settings()
    if old and old["currency"] != body.currency and repo.list_planned():
        raise HTTPException(409, "Remove your planned purchases before changing currency.")
    s = repo.put_settings(body.currency, f"{parse_money(body.monthly_budget):.2f}", f"{parse_money(body.spent):.2f}")
    return SettingsOut(configured=True, currency=s["currency"], monthly_budget=s["monthly_budget"], spent=s["spent"])


def _summary() -> BudgetSummary:
    s, planned = _settings(), repo.list_planned()
    if not s:
        return BudgetSummary(configured=False, currency="USD", monthly_budget_cents=0, spent_cents=0, planned_cents=0, remaining_cents=0, percent_committed=0.0, planned=[])
    budget, spent = parse_money(s["monthly_budget"]), parse_money(s["spent"])
    total_planned = sum((parse_money(p["amount"]) for p in planned), ZERO)
    committed = spent + total_planned
    pct = Decimal("0.0") if budget == 0 else (committed * 100 / budget).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return BudgetSummary(configured=True, currency=s["currency"], monthly_budget_cents=to_cents(budget), spent_cents=to_cents(spent), planned_cents=to_cents(total_planned),
                         remaining_cents=to_cents(budget - committed), percent_committed=float(pct), planned=[PlannedOut(**p) for p in planned])


@router.get("/budget/summary", response_model=BudgetSummary, **B)
def summary():
    return _summary()


@router.post("/planned", response_model=PlannedOut, **B)
def add_planned(body: PlannedIn):
    s = _settings()
    if not s:
        raise HTTPException(409, "Set your monthly budget first.")
    return PlannedOut(**repo.add_planned(body.name.strip(), f"{parse_money(body.amount):.2f}", s["currency"]))


@router.delete("/planned/{pid}", status_code=204)
def delete_planned(pid: str):
    if not repo.delete_planned(pid):
        raise HTTPException(404, "Planned purchase not found.")


@router.post("/budget/scenario", response_model=Affordability, **B)
def scenario(body: ScenarioIn):
    """What if I buy this? Counts spending so far and everything already planned."""
    s = _settings()
    if not s:
        raise HTTPException(409, "Set your monthly budget first.")
    committed = parse_money(s["spent"]) + sum((parse_money(p["amount"]) for p in repo.list_planned()), ZERO)
    return compute_affordability(body.price, s["monthly_budget"], f"{committed:.2f}", s["currency"], load_catalog())


# ---- saved analyses ----
@router.get("/analyses", response_model=list[SavedItem], **B)
def list_analyses():
    return [SavedItem(**a) for a in repo.list_analyses()]


@router.post("/analyses", response_model=SavedItem, **B)
def save_analysis(report: Report):
    repo.save_analysis(report.id, report.listing.name, report.assessment, report.model_dump_json(by_alias=True))
    return SavedItem(**repo.get_analysis(report.id))  # type: ignore[arg-type]


@router.get("/analyses/{aid}", response_model=Report, **B)
def get_analysis(aid: str):
    row = repo.get_analysis(aid)
    if not row:
        raise HTTPException(404, "That analysis was not saved.")
    return Report.model_validate_json(row["report_json"])


@router.delete("/analyses/{aid}", status_code=204)
def delete_analysis(aid: str):
    if not repo.delete_analysis(aid):
        raise HTTPException(404, "Analysis not found.")
