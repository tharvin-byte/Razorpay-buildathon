import os
import uuid
import io
import json
import pandas as pd
from datetime import datetime
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

# Automatically load environment variables from .env file
load_dotenv()
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, PlainTextResponse

from backend.models.schemas import (
    RunStatusResponse, SummaryResponse, ReconciliationResult,
    ChatRequest, ChatResponse, RecomputeRequest, ThresholdSweepPoint,
    ERPVoucherResponse, DisputeListResponse, StatutoryAuditDossier
)
from backend.engine.data_generator import SyntheticDataGenerator
from backend.engine.orchestrator import ReconciliationOrchestrator
from backend.engine.agents.assistant_agent import ReconciliationAssistant
from backend.engine.agents.erp_voucher_agent import ERPVoucherAgent
from backend.engine.agents.bank_dispute_agent import DisputeResolutionBot
from backend.engine.audit_exporter import AuditDossierExporter, EvaluationHarness

app = FastAPI(
    title="ReconX API",
    description="Multi-Source Financial Reconciliation Engine & Intelligence Controller",
    version="1.0.0"
)

# Enable CORS for Frontend Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================
# In-Memory Run Store
# =============================================================
class RunSession:
    def __init__(self, run_id: str):
        self.run_id = run_id
        self.created_at = datetime.now().isoformat()
        self.status = "idle" # idle, uploading, running, completed, failed
        self.processed = 0
        self.total = 0
        self.current_agent = "Initialized"
        self.current_record = ""
        self.error = None
        
        self.bank_df: Optional[pd.DataFrame] = None
        self.ledger_df: Optional[pd.DataFrame] = None
        self.settlement_df: Optional[pd.DataFrame] = None
        self.ground_truth: Optional[List[Dict[str, Any]]] = None
        
        self.confidence_threshold: float = 0.75
        self.orchestrator: Optional[ReconciliationOrchestrator] = None
        self.results: List[ReconciliationResult] = []
        self.summary: Optional[SummaryResponse] = None
        self.assistant = ReconciliationAssistant()

RUNS: Dict[str, RunSession] = {}

# Ensure a default demo run exists on startup
def init_default_demo_run():
    demo_id = "demo-run-001"
    session = RunSession(demo_id)
    gen = SyntheticDataGenerator(seed=42)
    df_bank, df_ledger, df_settle, gt = gen.generate_batch(total_bank_records=70)
    session.bank_df = df_bank
    session.ledger_df = df_ledger
    session.settlement_df = df_settle
    session.ground_truth = gt
    
    # Run orchestrator
    session.status = "running"
    session.orchestrator = ReconciliationOrchestrator(
        bank_df=df_bank,
        ledger_df=df_ledger,
        settlement_df=df_settle,
        confidence_threshold=0.75,
        ground_truth=gt
    )
    session.results = session.orchestrator.run_pipeline()
    session.summary = session.orchestrator.get_summary(run_id=demo_id)
    session.status = "completed"
    session.processed = len(df_bank)
    session.total = len(df_bank)
    session.current_agent = "Completed"
    RUNS[demo_id] = session

init_default_demo_run()

# =============================================================
# API Endpoints per Section 7 Contract
# =============================================================

@app.get("/")
def root():
    return {
        "app": "ReconX Multi-Source Reconciliation Agent",
        "status": "online",
        "version": "1.0.0",
        "active_runs": list(RUNS.keys())
    }

@app.post("/upload")
async def upload_sources(
    bank_file: Optional[UploadFile] = File(None),
    ledger_file: Optional[UploadFile] = File(None),
    settlement_file: Optional[UploadFile] = File(None),
    generate_synthetic: bool = Form(False),
    records_count: int = Form(70),
    seed: int = Form(42)
):
    """
    Accepts CSV uploads or generates a synthetic test batch. Returns run_id.
    """
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    session = RunSession(run_id)
    session.status = "uploading"
    
    if generate_synthetic or (bank_file is None and ledger_file is None):
        gen = SyntheticDataGenerator(seed=seed)
        df_bank, df_ledger, df_settle, gt = gen.generate_batch(total_bank_records=records_count)
        session.bank_df = df_bank
        session.ledger_df = df_ledger
        session.settlement_df = df_settle
        session.ground_truth = gt
    else:
        try:
            if bank_file:
                content = await bank_file.read()
                session.bank_df = pd.read_csv(io.BytesIO(content))
            if ledger_file:
                content = await ledger_file.read()
                session.ledger_df = pd.read_csv(io.BytesIO(content))
            if settlement_file:
                content = await settlement_file.read()
                session.settlement_df = pd.read_csv(io.BytesIO(content))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse CSV upload: {str(e)}")

    if session.bank_df is None or session.ledger_df is None:
        raise HTTPException(status_code=400, detail="Both bank_statement and internal_ledger are required.")
        
    session.total = len(session.bank_df)
    session.status = "idle"
    RUNS[run_id] = session
    
    return {
        "run_id": run_id,
        "bank_records_count": len(session.bank_df),
        "ledger_records_count": len(session.ledger_df),
        "settlement_records_count": len(session.settlement_df) if session.settlement_df is not None else 0,
        "has_ground_truth": session.ground_truth is not None,
        "status": session.status
    }

def _execute_pipeline_task(run_id: str, threshold: float):
    session = RUNS.get(run_id)
    if not session:
        return
        
    session.status = "running"
    session.confidence_threshold = threshold
    
    def progress_callback(processed: int, total: int, agent: str, rec_id: str):
        session.processed = processed
        session.total = total
        session.current_agent = agent
        session.current_record = rec_id

    try:
        session.orchestrator = ReconciliationOrchestrator(
            bank_df=session.bank_df,
            ledger_df=session.ledger_df,
            settlement_df=session.settlement_df,
            confidence_threshold=threshold,
            ground_truth=session.ground_truth
        )
        session.results = session.orchestrator.run_pipeline(progress_callback=progress_callback)
        session.summary = session.orchestrator.get_summary(run_id=run_id)
        session.status = "completed"
        session.current_agent = "Completed"
    except Exception as e:
        session.status = "failed"
        session.error = str(e)

@app.post("/run/{run_id}")
def start_reconciliation_run(
    run_id: str,
    background_tasks: BackgroundTasks,
    threshold: float = Query(0.75, ge=0.5, le=0.99)
):
    session = RUNS.get(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
        
    session.status = "running"
    session.processed = 0
    background_tasks.add_task(_execute_pipeline_task, run_id, threshold)
    return {"message": "Reconciliation pipeline started", "run_id": run_id, "status": "running"}

@app.get("/run/{run_id}/status", response_model=RunStatusResponse)
def get_run_status(run_id: str):
    session = RUNS.get(run_id)
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

@app.get("/run/{run_id}/sources")
def get_sources_metadata(run_id: str):
    session = RUNS.get(run_id)
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

@app.get("/run/{run_id}/transactions", response_model=List[ReconciliationResult])
def get_transactions(
    run_id: str,
    status_filter: Optional[str] = Query(None),
    source_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    session = RUNS.get(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
        
    res = session.results
    if status_filter:
        res = [r for r in res if r.status == status_filter]
    if source_filter:
        res = [r for r in res if r.source_type == source_filter]
    if search:
        s_clean = search.upper()
        res = [
            r for r in res
            if s_clean in r.record_id.upper() or s_clean in r.explanation.upper()
        ]
    return res

@app.get("/run/{run_id}/discrepancies", response_model=List[ReconciliationResult])
def get_discrepancies(run_id: str, disc_type: Optional[str] = Query(None)):
    session = RUNS.get(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
        
    disc_list = [r for r in session.results if r.status == "matched_with_discrepancy"]
    if disc_type:
        disc_list = [
            r for r in disc_list
            if any(d.type == disc_type for d in r.discrepancies)
        ]
    return disc_list

@app.get("/run/{run_id}/exceptions", response_model=List[ReconciliationResult])
def get_exceptions(run_id: str, side: Optional[str] = Query(None)):
    session = RUNS.get(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
        
    exc_list = [r for r in session.results if r.status == "exception"]
    if side:
        exc_list = [r for r in exc_list if r.exception_side == side]
    return exc_list

@app.get("/run/{run_id}/transaction/{txn_id}", response_model=ReconciliationResult)
def get_transaction_detail(run_id: str, txn_id: str):
    session = RUNS.get(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
        
    for r in session.results:
        if r.record_id == txn_id:
            return r
    raise HTTPException(status_code=404, detail=f"Transaction {txn_id} not found in run {run_id}")

@app.get("/run/{run_id}/trace/{txn_id}")
def get_transaction_trace(run_id: str, txn_id: str):
    session = RUNS.get(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
        
    for r in session.results:
        if r.record_id == txn_id:
            return {
                "record_id": txn_id,
                "status": r.status,
                "confidence_score": r.confidence_score,
                "trace": r.trace
            }
    raise HTTPException(status_code=404, detail=f"Transaction {txn_id} not found in run {run_id}")

@app.get("/run/{run_id}/summary", response_model=SummaryResponse)
def get_summary(run_id: str):
    session = RUNS.get(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
        
    if not session.summary and session.results:
        session.summary = session.orchestrator.get_summary(run_id=run_id)
    return session.summary or SummaryResponse(
        run_id=run_id,
        total_bank_records=len(session.bank_df) if session.bank_df is not None else 0,
        total_ledger_records=len(session.ledger_df) if session.ledger_df is not None else 0,
        total_settlement_records=len(session.settlement_df) if session.settlement_df is not None else 0,
        matched_clean_count=0,
        matched_discrepancy_count=0,
        exception_bank_count=0,
        exception_ledger_count=0,
        expected_non_match_count=0,
        match_rate=0.0,
        discrepancy_breakdown={},
        current_threshold=session.confidence_threshold
    )

@app.post("/run/{run_id}/recompute", response_model=SummaryResponse)
def recompute_threshold(run_id: str, req: RecomputeRequest):
    """
    Fast re-thresholding without repeating expensive LLM calls.
    Re-runs deterministic orchestrator with new threshold.
    """
    session = RUNS.get(run_id)
    if not session or session.bank_df is None:
        raise HTTPException(status_code=404, detail="Run session not found")
        
    session.confidence_threshold = req.threshold
    session.orchestrator = ReconciliationOrchestrator(
        bank_df=session.bank_df,
        ledger_df=session.ledger_df,
        settlement_df=session.settlement_df,
        confidence_threshold=req.threshold,
        ground_truth=session.ground_truth
    )
    session.results = session.orchestrator.run_pipeline()
    session.summary = session.orchestrator.get_summary(run_id=run_id)
    return session.summary

@app.get("/run/{run_id}/threshold_sweep", response_model=List[ThresholdSweepPoint])
def get_threshold_sweep(run_id: str):
    session = RUNS.get(run_id)
    if not session or not session.ground_truth:
        raise HTTPException(status_code=400, detail="Threshold sweep requires hidden ground truth")
        
    return EvaluationHarness.sweep_thresholds(
        bank_df=session.bank_df,
        ledger_df=session.ledger_df,
        settlement_df=session.settlement_df,
        ground_truth=session.ground_truth,
        start=0.55,
        end=0.90,
        step=0.05
    )

@app.post("/chat", response_model=ChatResponse)
def chat_assistant(req: ChatRequest):
    session = RUNS.get(req.run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
        
    if not session.summary and session.results:
        session.summary = session.orchestrator.get_summary(run_id=req.run_id)
        
    answer, relevant_ids = session.assistant.answer_query(
        question=req.question,
        summary=session.summary,
        results=session.results
    )
    
    return ChatResponse(
        answer=answer,
        relevant_record_ids=relevant_ids,
        confidence=1.0
    )

@app.get("/run/{run_id}/report")
def get_report_display(run_id: str):
    session = RUNS.get(run_id)
    if not session or not session.summary:
        raise HTTPException(status_code=404, detail="Run session or summary not ready")
        
    s = session.summary
    report = {
        "title": f"ReconX Financial Controller Audit Report — Run {run_id}",
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "executive_summary": {
            "total_transactions": len(session.results),
            "match_rate": f"{s.match_rate * 100:.2f}%",
            "clean_matches": s.matched_clean_count,
            "discrepancies_flagged": s.matched_discrepancy_count,
            "bank_orphans": s.exception_bank_count,
            "ledger_orphans": s.exception_ledger_count,
            "expected_non_matches": s.expected_non_match_count
        },
        "discrepancy_breakdown": s.discrepancy_breakdown,
        "evaluation_metrics": s.evaluation.model_dump() if s.evaluation else None,
        "ledger_orphan_exceptions": [
            {
                "id": r.record_id,
                "amount": r.matched_ledger_record.gross_amount if r.matched_ledger_record else 0,
                "counterparty": r.matched_ledger_record.counterparty_name if r.matched_ledger_record else "",
                "invoice": r.matched_ledger_record.invoice_ref if r.matched_ledger_record else "",
                "reason": r.exception_reason
            }
            for r in session.results if r.source_type == "ledger" and r.status == "exception"
        ],
        "top_discrepancies": [
            {
                "bank_id": r.record_id,
                "ledger_id": r.matched_ledger_record.ledger_entry_id if r.matched_ledger_record else "",
                "amount": r.bank_record.amount if r.bank_record else 0,
                "explanation": r.explanation
            }
            for r in session.results if r.status == "matched_with_discrepancy"
        ][:10]
    }
    return report

@app.get("/run/{run_id}/report/download")
def download_report(run_id: str, format: str = Query("json", pattern="^(json|csv)$")):
    session = RUNS.get(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
        
    if format == "json":
        report_data = get_report_display(run_id)
        return Response(
            content=json.dumps(report_data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=reconx_report_{run_id}.json"}
        )
    elif format == "csv":
        # Export all transaction reconciliation results as CSV
        rows = []
        for r in session.results:
            rows.append({
                "record_id": r.record_id,
                "source_type": r.source_type,
                "status": r.status,
                "confidence_score": r.confidence_score,
                "amount": r.bank_record.amount if r.bank_record else (r.matched_ledger_record.gross_amount if r.matched_ledger_record else 0.0),
                "matched_ledger_id": r.matched_ledger_record.ledger_entry_id if r.matched_ledger_record else (", ".join(r.matched_ledger_ids) if r.matched_ledger_ids else ""),
                "discrepancies": "; ".join([d.type for d in r.discrepancies]),
                "explanation": r.explanation,
                "exception_side": r.exception_side or "",
                "exception_reason": r.exception_reason or ""
            })
        df = pd.DataFrame(rows)
        csv_str = df.to_csv(index=False)
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=reconx_results_{run_id}.csv"}
        )

# =============================================================
# Autonomous Action Suite Endpoints
# =============================================================

@app.get("/run/{run_id}/erp-vouchers", response_model=ERPVoucherResponse)
def get_erp_vouchers(run_id: str):
    """
    Synthesizes balanced double-entry accounting vouchers for Tally Prime and SAP S/4HANA.
    """
    session = RUNS.get(run_id)
    if not session or not session.results:
        raise HTTPException(status_code=404, detail="Run session not found or results not ready")
    return ERPVoucherAgent.generate_vouchers_for_run(run_id=run_id, results=session.results)

@app.get("/run/{run_id}/erp-vouchers/tally-xml")
def download_tally_xml(run_id: str):
    """
    Downloads ready-to-import Tally Prime XML envelope.
    """
    session = RUNS.get(run_id)
    if not session or not session.results:
        raise HTTPException(status_code=404, detail="Run session not found or results not ready")
    vch_resp = ERPVoucherAgent.generate_vouchers_for_run(run_id=run_id, results=session.results)
    return Response(
        content=vch_resp.tally_batch_xml,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=reconx_tally_vouchers_{run_id}.xml"}
    )

@app.get("/run/{run_id}/disputes", response_model=DisputeListResponse)
def get_disputes(run_id: str):
    """
    Generates formal ISO 20022 and NPCI evidence-grounded bank dispute claims.
    """
    session = RUNS.get(run_id)
    if not session or not session.results:
        raise HTTPException(status_code=404, detail="Run session not found or results not ready")
    return DisputeResolutionBot.generate_disputes_for_run(run_id=run_id, results=session.results)

@app.get("/run/{run_id}/statutory-dossier", response_model=StatutoryAuditDossier)
def get_statutory_dossier(run_id: str):
    """
    Generates official RBI Form 3CB/CD statutory compliance audit dossier.
    """
    session = RUNS.get(run_id)
    if not session or not session.results:
        raise HTTPException(status_code=404, detail="Run session not found or results not ready")
    if not session.summary:
        session.summary = session.orchestrator.get_summary(run_id=run_id)
    return AuditDossierExporter.generate_dossier_for_run(
        summary=session.summary,
        results=session.results
    )

@app.get("/run/{run_id}/statutory-dossier/download")
def download_statutory_dossier(run_id: str):
    """
    Downloads certified statutory audit dossier as signed text document.
    """
    session = RUNS.get(run_id)
    if not session or not session.results:
        raise HTTPException(status_code=404, detail="Run session not found or results not ready")
    if not session.summary:
        session.summary = session.orchestrator.get_summary(run_id=run_id)
    dossier = AuditDossierExporter.generate_dossier_for_run(
        summary=session.summary,
        results=session.results
    )
    return Response(
        content=dossier.full_statutory_text,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=rbi_statutory_dossier_{run_id}.txt"}
    )

