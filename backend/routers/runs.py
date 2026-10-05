import io
import uuid
import logging
from typing import Optional
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, BackgroundTasks

from backend.models.schemas import RunStatusResponse
from backend.services.run_service import get_session, create_session, execute_pipeline_task
from backend.services.ingestion_service import (
    MAX_UPLOAD_BYTES, MAX_SYNTHETIC_BANK_ROWS,
    normalize_uploaded_frame, generate_synthetic_run
)

router = APIRouter(tags=["Runs & Ingestion"])
logger = logging.getLogger("reconx.routers.runs")


@router.post("/upload")
async def upload_sources(
    bank_file: Optional[UploadFile] = File(None),
    ledger_file: Optional[UploadFile] = File(None),
    settlement_file: Optional[UploadFile] = File(None),
    generate_synthetic: bool = Form(False),
    records_count: int = Form(70, ge=1, le=MAX_SYNTHETIC_BANK_ROWS),
    seed: int = Form(42)
):
    """
    Accepts CSV uploads or generates a synthetic test batch. Returns run_id.
    """
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    session = create_session(run_id)
    session.status = "uploading"

    has_uploaded_files = any((bank_file, ledger_file, settlement_file))
    if generate_synthetic and has_uploaded_files:
        raise HTTPException(status_code=400, detail="Choose synthetic generation or CSV upload, not both.")
    if has_uploaded_files:
        raise HTTPException(
            status_code=503,
            detail="CSV uploads are disabled until authenticated access is configured. Synthetic demo runs remain available.",
        )

    if generate_synthetic or (bank_file is None and ledger_file is None):
        df_bank, df_ledger, df_settle, gt = generate_synthetic_run(records_count=records_count, seed=seed)
        session.bank_df = df_bank
        session.ledger_df = df_ledger
        session.settlement_df = df_settle
        session.ground_truth = gt
    else:
        try:
            for source, uploaded_file in (
                ("bank", bank_file), ("ledger", ledger_file), ("settlement", settlement_file)
            ):
                if uploaded_file is None:
                    continue
                content = await uploaded_file.read(MAX_UPLOAD_BYTES + 1)
                if len(content) > MAX_UPLOAD_BYTES:
                    raise ValueError(f"{source} CSV exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit")
                frame = pd.read_csv(io.BytesIO(content))
                frame = normalize_uploaded_frame(frame, source)
                if source == "bank":
                    session.bank_df = frame
                elif source == "ledger":
                    session.ledger_df = frame
                else:
                    session.settlement_df = frame
        except Exception:
            logger.exception("CSV upload validation failed")
            raise HTTPException(status_code=400, detail="Invalid CSV upload. Check the documented schema and field values.")

    if session.bank_df is None or session.ledger_df is None:
        raise HTTPException(
            status_code=400,
            detail="Bank statement and internal ledger CSVs are required; settlement report is optional."
        )

    session.total = len(session.bank_df) if session.bank_df is not None else 0
    session.status = "idle"

    return {
        "run_id": run_id,
        "bank_records_count": len(session.bank_df) if session.bank_df is not None else 0,
        "ledger_records_count": len(session.ledger_df) if session.ledger_df is not None else 0,
        "settlement_records_count": len(session.settlement_df) if session.settlement_df is not None else 0,
        "has_ground_truth": session.ground_truth is not None,
        "status": session.status
    }


@router.post("/run/{run_id}")
def start_reconciliation_run(
    run_id: str,
    background_tasks: BackgroundTasks,
    threshold: float = Query(0.75, ge=0.5, le=0.99)
):
    session = get_session(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
    with session.operation_lock:
        if session.status == "running":
            raise HTTPException(status_code=409, detail="A reconciliation operation is already running")
        session.status = "running"
        session.processed = 0
        session.error = None
        session.summary = None
        session.results = []
        session.sweep_points = None
    background_tasks.add_task(execute_pipeline_task, run_id, threshold)
    return {"message": "Reconciliation pipeline started", "run_id": run_id, "status": "running"}


@router.get("/run/{run_id}/status", response_model=RunStatusResponse)
def get_run_status(run_id: str):
    session = get_session(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
    return RunStatusResponse(
        run_id=run_id,
        status=session.status,
        processed=session.processed,
        total=session.total,
        current_agent=session.current_agent,
        current_record=session.current_record,
        error=session.error
    )


@router.get("/run/{run_id}/sources")
def get_sources_metadata(run_id: str):
    session = get_session(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")

    return {
        "run_id": run_id,
        "bank_statement": {
            "rows": len(session.bank_df) if session.bank_df is not None else 0,
            "columns": list(session.bank_df.columns) if session.bank_df is not None else [],
            "sample": session.bank_df.head(5).to_dict(orient="records") if session.bank_df is not None else []
        },
        "internal_ledger": {
            "rows": len(session.ledger_df) if session.ledger_df is not None else 0,
            "columns": list(session.ledger_df.columns) if session.ledger_df is not None else [],
            "sample": session.ledger_df.head(5).to_dict(orient="records") if session.ledger_df is not None else []
        },
        "settlement_report": {
            "rows": len(session.settlement_df) if session.settlement_df is not None else 0,
            "columns": list(session.settlement_df.columns) if session.settlement_df is not None else [],
            "sample": session.settlement_df.head(5).to_dict(orient="records") if session.settlement_df is not None else []
        },
        "has_ground_truth": session.ground_truth is not None
    }
