import os
import sys
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure UTF-8 output encoding on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Automatically load environment variables from .env file
load_dotenv()

from backend.services.run_service import (
    RUNS, RunSession, init_default_demo_run, list_active_runs
)
from backend.services.ingestion_service import (
    normalize_uploaded_frame as _normalize_uploaded_frame,
    MAX_UPLOAD_BYTES, MAX_SOURCE_ROWS, MAX_SYNTHETIC_BANK_ROWS, MAX_FIELD_LENGTH,
    SOURCE_REQUIRED_COLUMNS, SOURCE_ID_COLUMNS
)
from backend.services.export_service import (
    escape_csv_formula_value as _escape_csv_formula_value
)

from backend.routers import (
    runs, reconciliation, assistant, reports, actions
)

logger = logging.getLogger("reconx.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed demo run on server startup if enabled
    if os.environ.get("RECONX_SEED_DEMO", "true").lower() in ("true", "1", "yes"):
        init_default_demo_run()
    yield


app = FastAPI(
    title="ReconX API",
    description="Multi-Source Financial Reconciliation Engine & Intelligence Controller",
    version="1.0.0",
    lifespan=lifespan
)

configured_origins = os.environ.get(
    "RECONX_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
)
allowed_origins = [
    origin.strip() for origin in configured_origins.split(",")
    if origin.strip() and origin.strip() != "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "app": "ReconX Multi-Source Reconciliation Agent",
        "status": "online",
        "version": "1.0.0",
        "active_runs": list_active_runs()
    }


# Include modular routers
app.include_router(runs.router)
app.include_router(reconciliation.router)
app.include_router(assistant.router)
app.include_router(reports.router)
app.include_router(actions.router)

# Also mount under /api/v1 for future API versioning compatibility
app.include_router(runs.router, prefix="/api/v1")
app.include_router(reconciliation.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(actions.router, prefix="/api/v1")
