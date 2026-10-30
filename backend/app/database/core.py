"""Shared SQLite plumbing. Single-user demo mode: there are no accounts, so all rows belong to the one local user."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, paypal_order_id TEXT UNIQUE NOT NULL, product_id TEXT NOT NULL, product_name TEXT NOT NULL,
      amount TEXT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, capture_id TEXT, failure_reason TEXT,
      analysis_id TEXT, budget_remaining_cents INTEGER, environment TEXT NOT NULL DEFAULT 'sandbox',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS budget_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1), currency TEXT NOT NULL, monthly_budget TEXT NOT NULL, spent TEXT NOT NULL, updated_at TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS planned_purchases (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, amount TEXT NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS saved_analyses (
      id TEXT PRIMARY KEY, product_name TEXT NOT NULL, assessment TEXT NOT NULL, report_json TEXT NOT NULL, created_at TEXT NOT NULL)""",
]


def db_path() -> str:
    return os.getenv("SAFEBUY_DB", str(Path(__file__).resolve().parents[2] / "safebuy.db"))


@contextmanager
def conn():
    c = sqlite3.connect(db_path())
    c.row_factory = sqlite3.Row
    try:
        for stmt in SCHEMA:
            c.execute(stmt)
        yield c
        c.commit()
    finally:
        c.close()
