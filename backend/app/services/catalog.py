import json
from functools import lru_cache
from pathlib import Path

from app.schemas.analysis import CatalogProduct

CATALOG_PATH = Path(__file__).resolve().parents[3] / "data" / "catalog.json"


@lru_cache
def load_catalog() -> tuple[CatalogProduct, ...]:
    """Curated DEMO catalog. Products and sellers are invented, never verified."""
    return tuple(CatalogProduct.model_validate(p) for p in json.loads(CATALOG_PATH.read_text()))


def get_product(pid: str) -> CatalogProduct | None:
    return next((p for p in load_catalog() if p.id == pid), None)
