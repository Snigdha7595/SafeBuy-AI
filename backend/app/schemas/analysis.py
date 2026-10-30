from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.services.money import parse_money

Severity = Literal["low", "medium", "high"]
Confidence = Literal["low", "medium", "high"]
Assessment = Literal[
    "No major concerns identified in the supplied information",
    "Some details require verification",
    "Multiple material concerns require attention",
    "Insufficient information to assess",
]
Currency = Literal["USD", "EUR", "GBP"]


class CamelModel(BaseModel):
    """JSON uses camelCase (matches the frontend); Python uses snake_case."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class Listing(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    price: str
    currency: Currency = "USD"
    seller: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=5000)
    listing_text: str = Field(default="", max_length=8000)
    return_policy: str = Field(default="", max_length=3000)
    warranty: str = Field(default="", max_length=3000)
    url: str = Field(default="", max_length=2000)
    evidence: str = Field(default="", max_length=3000)

    @field_validator("price")
    @classmethod
    def _price(cls, v: str) -> str:
        if parse_money(v, field="price") <= 0:
            raise ValueError("price must be greater than zero")
        return v

    @field_validator("url")
    @classmethod
    def _url(cls, v: str) -> str:
        if v.strip() and not v.strip().lower().startswith(("http://", "https://")):
            raise ValueError("url must start with http:// or https://")
        return v.strip()

    def all_text(self) -> str:
        return "\n".join([self.name, self.seller, self.description, self.listing_text, self.return_policy, self.warranty, self.evidence])


class BudgetInput(CamelModel):
    available: str
    existing: str = ""
    urgency: Literal["low", "normal", "high"] = "normal"
    priorities: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("available")
    @classmethod
    def _available(cls, v: str) -> str:
        parse_money(v, field="available budget")
        return v

    @field_validator("existing")
    @classmethod
    def _existing(cls, v: str) -> str:
        if v.strip():
            parse_money(v, field="existing spending")
        return v


class AnalyzeRequest(CamelModel):
    listing: Listing
    budget: BudgetInput
    catalog_id: str | None = Field(default=None, max_length=50)


class CatalogProduct(Listing):
    id: str
    specs: dict[str, str] = Field(default_factory=dict)
    known_gaps: list[str] = Field(default_factory=list)


class Finding(CamelModel):
    id: str
    title: str
    severity: Severity
    confidence: Confidence
    observed: str
    source: str
    why_it_matters: str
    verify: str


class Affordability(CamelModel):
    price_cents: int = 0
    budget_cents: int = 0
    remaining_cents: int = 0
    percent_used: float = 0.0
    fits: bool = False
    shortfall_cents: int = 0
    alternatives: list[CatalogProduct] = Field(default_factory=list)
    error: str | None = None


class SellerItem(CamelModel):
    label: str
    status: Literal["present", "missing", "unclear"]
    note: str


class PriceContext(CamelModel):
    basis: str
    comparable_count: int
    note: str


class Report(CamelModel):
    id: str
    created_at: datetime
    mode: Literal["demo-rules", "llm"]
    model: str | None = None
    notes: list[str] = Field(default_factory=list)
    catalog_id: str | None = None
    listing: Listing
    budget: BudgetInput
    assessment: Assessment
    summary: str
    observed: list[str]
    findings: list[Finding]
    missing: list[str]
    seller: list[SellerItem]
    price_context: PriceContext
    affordability: Affordability
    next_step: str


# ---- What we require the LLM to return (validated before anything is shown) ----
class LLMFinding(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    severity: Severity
    confidence: Confidence
    basis: Literal["observed", "absence", "inferred"]
    observed: str = Field(min_length=3, max_length=500)
    evidence_quote: str | None = Field(default=None, max_length=400)
    why_it_matters: str = Field(min_length=3, max_length=500)
    verify: str = Field(min_length=3, max_length=400)


class LLMAnalysis(BaseModel):
    assessment: Assessment
    summary: str = Field(min_length=3, max_length=600)
    findings: list[LLMFinding] = Field(max_length=10)
    missing_information: list[str] = Field(max_length=10)
    next_step: str = Field(min_length=3, max_length=400)
