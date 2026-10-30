import uuid
from datetime import datetime, timezone

from app.database.core import conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---- budget settings (one row) ----
def get_settings() -> dict | None:
    with conn() as c:
        r = c.execute("SELECT * FROM budget_settings WHERE id=1").fetchone()
    return dict(r) if r else None


def put_settings(currency: str, monthly_budget: str, spent: str) -> dict:
    with conn() as c:
        c.execute("INSERT INTO budget_settings (id, currency, monthly_budget, spent, updated_at) VALUES (1,?,?,?,?) "
                  "ON CONFLICT(id) DO UPDATE SET currency=excluded.currency, monthly_budget=excluded.monthly_budget, spent=excluded.spent, updated_at=excluded.updated_at",
                  (currency, monthly_budget, spent, _now()))
    return get_settings()  # type: ignore[return-value]


# ---- planned purchases ----
def add_planned(name: str, amount: str, currency: str) -> dict:
    pid = f"pl_{uuid.uuid4().hex[:12]}"
    with conn() as c:
        c.execute("INSERT INTO planned_purchases VALUES (?,?,?,?,?)", (pid, name, amount, currency, _now()))
        return dict(c.execute("SELECT * FROM planned_purchases WHERE id=?", (pid,)).fetchone())


def list_planned() -> list[dict]:
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM planned_purchases ORDER BY created_at")]


def delete_planned(pid: str) -> bool:
    with conn() as c:
        return c.execute("DELETE FROM planned_purchases WHERE id=?", (pid,)).rowcount > 0


# ---- saved analyses ----
def save_analysis(aid: str, product_name: str, assessment: str, report_json: str) -> None:
    with conn() as c:
        c.execute("INSERT INTO saved_analyses VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET report_json=excluded.report_json, assessment=excluded.assessment",
                  (aid, product_name, assessment, report_json, _now()))


def list_analyses() -> list[dict]:
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT id, product_name, assessment, created_at FROM saved_analyses ORDER BY created_at DESC")]


def get_analysis(aid: str) -> dict | None:
    with conn() as c:
        r = c.execute("SELECT * FROM saved_analyses WHERE id=?", (aid,)).fetchone()
    return dict(r) if r else None


def delete_analysis(aid: str) -> bool:
    with conn() as c:
        return c.execute("DELETE FROM saved_analyses WHERE id=?", (aid,)).rowcount > 0
