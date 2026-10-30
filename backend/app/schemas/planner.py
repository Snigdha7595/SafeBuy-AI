from pydantic import Field, field_validator

from app.schemas.analysis import CamelModel, Currency
from app.services.money import parse_money


class _Money(CamelModel):
    @staticmethod
    def _chk(v: str, field: str) -> str:
        parse_money(v, field=field)
        return v


class SettingsIn(_Money):
    currency: Currency = "USD"
    monthly_budget: str
    spent: str = "0"

    @field_validator("monthly_budget")
    @classmethod
    def _b(cls, v): return cls._chk(v, "monthly budget")

    @field_validator("spent")
    @classmethod
    def _s(cls, v): return cls._chk(v or "0", "spent so far")


class SettingsOut(CamelModel):
    configured: bool
    currency: Currency = "USD"
    monthly_budget: str = "0.00"
    spent: str = "0.00"


class PlannedIn(_Money):
    name: str = Field(min_length=1, max_length=120)
    amount: str

    @field_validator("amount")
    @classmethod
    def _a(cls, v):
        if parse_money(v, field="amount") <= 0:
            raise ValueError("amount must be greater than zero")
        return v


class PlannedOut(CamelModel):
    id: str
    name: str
    amount: str
    currency: Currency


class BudgetSummary(CamelModel):
    configured: bool
    currency: Currency
    monthly_budget_cents: int
    spent_cents: int
    planned_cents: int
    remaining_cents: int
    percent_committed: float
    planned: list[PlannedOut]


class ScenarioIn(_Money):
    price: str

    @field_validator("price")
    @classmethod
    def _p(cls, v):
        if parse_money(v, field="price") <= 0:
            raise ValueError("price must be greater than zero")
        return v


class SavedItem(CamelModel):
    id: str
    product_name: str
    assessment: str
    created_at: str
