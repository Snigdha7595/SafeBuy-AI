from typing import Literal

from pydantic import Field

from app.schemas.analysis import CamelModel


class CheckoutRequest(CamelModel):
    product_id: str = Field(max_length=50)
    approved: Literal[True]  # the shopper must explicitly approve; the AI never triggers payment
    analysis_id: str | None = Field(default=None, max_length=50)
    available: str = ""
    existing: str = ""
    # Any client-sent amount/currency is ignored (extra="ignore"); price always comes from the server catalog.


class CheckoutConfig(CamelModel):
    configured: bool
    client_id: str | None
    environment: str = "sandbox"
    currency: str = "USD"
    webhook_configured: bool = False


class OrderCreated(CamelModel):
    order_id: str
    transaction_id: str
    amount: str
    currency: str


class TransactionOut(CamelModel):
    id: str
    paypal_order_id: str
    product_id: str
    product_name: str
    amount: str
    currency: str
    status: Literal["CREATED", "PENDING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED"]
    capture_id: str | None = None
    failure_reason: str | None = None
    analysis_id: str | None = None
    budget_remaining_cents: int | None = None
    environment: str = "sandbox"
    created_at: str
    updated_at: str
