import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.checkout import router as checkout_router
from app.api.planner import router as planner_router
from app.api.routes import router
from app.api.webhooks import router as webhook_router
from app.core.config import get_settings
from app.core.static import mount_frontend

app = FastAPI(title="SafeBuy AI API", version="0.6.0")
app.add_middleware(CORSMiddleware, allow_origins=get_settings().allowed_origins, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"])
app.include_router(router)
app.include_router(checkout_router)
app.include_router(planner_router)
app.include_router(webhook_router)
mount_frontend(app, os.getenv("FRONTEND_DIST"))  # last, so /api routes always win
