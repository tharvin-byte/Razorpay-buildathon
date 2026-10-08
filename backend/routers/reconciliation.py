import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from backend.models.schemas import (
    ReconciliationResult, SummaryResponse, RecomputeRequest, ThresholdSweepPoint
)
from backend.services.run_service import get_session, recompute_run
from backend.engine.audit_exporter import EvaluationHarness

router = APIRouter(tags=["Reconciliation"])
logger = logging.getLogger("reconx.routers.reconciliation")


@router.get("/run/{run_id}/transactions", response_model=List[ReconciliationResult])
def get_transactions(
    run_id: str,
    status_filter: Optional[str] = Query(None),
    source_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=10_000),
    offset: int = Query(0, ge=0)
):
    session = get_session(run_id)
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
    if limit is not None:
        return res[offset : offset + limit]
    return res


@router.get("/run/{run_id}/discrepancies", response_model=List[ReconciliationResult])
def get_discrepancies(
    run_id: str,
    disc_type: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=10_000),
    offset: int = Query(0, ge=0)
):
    session = get_session(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")

    disc_list = [r for r in session.results if r.status == "matched_with_discrepancy"]
    if disc_type:
        disc_list = [
            r for r in disc_list
            if any(d.type == disc_type for d in r.discrepancies)
        ]
    if limit is not None:
        return disc_list[offset : offset + limit]
    return disc_list


@router.get("/run/{run_id}/exceptions", response_model=List[ReconciliationResult])
def get_exceptions(
    run_id: str,
    side: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=10_000),
    offset: int = Query(0, ge=0)
):
    session = get_session(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")

    exc_list = [r for r in session.results if r.status == "exception"]
    if side:
        exc_list = [r for r in exc_list if r.exception_side == side]
    if limit is not None:
        return exc_list[offset : offset + limit]
    return exc_list


@router.get("/run/{run_id}/transaction/{txn_id}", response_model=ReconciliationResult)
def get_transaction_detail(run_id: str, txn_id: str):
    session = get_session(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")

    for r in session.results:
        if r.record_id == txn_id:
            return r
    raise HTTPException(status_code=404, detail=f"Transaction {txn_id} not found in run {run_id}")


@router.get("/run/{run_id}/trace/{txn_id}")
def get_transaction_trace(run_id: str, txn_id: str):
    session = get_session(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")

    for result in session.results:
        if result.record_id == txn_id:
            steps = [step.model_dump() for step in result.trace]
            return {
                "record_id": result.record_id,
                "status": result.status,
                "confidence_score": result.confidence_score,
                "trace_available": bool(steps),
                "trace": steps,
            }
    raise HTTPException(status_code=404, detail=f"Transaction {txn_id} not found in run {run_id}")


@router.get("/run/{run_id}/summary", response_model=SummaryResponse)
def get_summary(run_id: str):
    session = get_session(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")

    if not session.summary and session.results and session.orchestrator:
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


@router.post("/run/{run_id}/recompute", response_model=SummaryResponse)
def recompute_threshold(run_id: str, req: RecomputeRequest):
    """
    Fast re-thresholding without repeating expensive LLM calls.
    Re-runs deterministic orchestrator with new threshold.
    """
    session = get_session(run_id)
    if not session or session.bank_df is None:
        raise HTTPException(status_code=404, detail="Run session not found")

    try:
        return recompute_run(run_id=run_id, threshold=req.threshold)
    except RuntimeError as re:
        raise HTTPException(status_code=409, detail=str(re))
    except Exception as e:
        logger.exception("Threshold recompute failed for run_id=%s: %s", run_id, e)
        raise HTTPException(status_code=500, detail="Threshold recompute failed. Check server logs for details.")


@router.get("/run/{run_id}/threshold_sweep", response_model=List[ThresholdSweepPoint])
def get_threshold_sweep(run_id: str):
    session = get_session(run_id)
    if not session or not session.ground_truth:
        raise HTTPException(status_code=400, detail="Threshold sweep requires hidden ground truth")

    if getattr(session, "sweep_points", None):
        return session.sweep_points

    points = EvaluationHarness.sweep_thresholds(
        bank_df=session.bank_df,
        ledger_df=session.ledger_df,
        settlement_df=session.settlement_df,
        ground_truth=session.ground_truth,
        start=0.55,
        end=0.90,
        step=0.05,
        base_results=session.results
    )
    session.sweep_points = points
    return points
