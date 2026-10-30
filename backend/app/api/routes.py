from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.core.ratelimit import limit_analyze
from app.schemas.analysis import Affordability, AnalyzeRequest, CamelModel, CatalogProduct, Currency, Report
from app.services.affordability import compute_affordability
from app.services.analysis import run_analysis
from app.services.catalog import load_catalog

router = APIRouter(prefix="/api")


class Health(CamelModel):
    status: str
    ai_mode: str
    paypal_configured: bool


class AffordabilityRequest(CamelModel):
    price: str
    available: str
    existing: str = ""
    currency: Currency = "USD"


@router.get("/health", response_model=Health, response_model_by_alias=True)
def health():
    s = get_settings()
    return Health(status="ok", ai_mode="live" if s.llm_configured else "demo", paypal_configured=s.paypal_configured)


@router.get("/catalog", response_model=list[CatalogProduct], response_model_by_alias=True)
def catalog():
    return list(load_catalog())


@router.post("/affordability", response_model=Affordability, response_model_by_alias=True)
def affordability(req: AffordabilityRequest):
    return compute_affordability(req.price, req.available, req.existing, req.currency, load_catalog())


@router.post("/analyze", response_model=Report, response_model_by_alias=True, dependencies=[Depends(limit_analyze)])
async def analyze(req: AnalyzeRequest):
    return await run_analysis(req)
