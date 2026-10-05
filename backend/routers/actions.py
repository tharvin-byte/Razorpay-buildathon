from fastapi import APIRouter, HTTPException, Response

from backend.models.schemas import (
    ERPVoucherResponse, DisputeListResponse, StatutoryAuditDossier
)
from backend.services.run_service import get_session
from backend.engine.agents.erp_voucher_agent import ERPVoucherAgent
from backend.engine.agents.bank_dispute_agent import DisputeResolutionBot
from backend.engine.audit_exporter import AuditDossierExporter

router = APIRouter(tags=["Autonomous Action Suite"])


@router.get("/run/{run_id}/erp-vouchers", response_model=ERPVoucherResponse)
def get_erp_vouchers(run_id: str):
    """
    Returns approved balanced voucher entries and separately listed items requiring manual review.
    """
    session = get_session(run_id)
    if not session or not session.results:
        raise HTTPException(status_code=404, detail="Run session not found or results not ready")
    return ERPVoucherAgent.generate_vouchers_for_run(run_id=run_id, results=session.results)


@router.get("/run/{run_id}/erp-vouchers/tally-xml")
def download_tally_xml(run_id: str):
    """
    Downloads the XML representation of approved voucher entries.
    """
    session = get_session(run_id)
    if not session or not session.results:
        raise HTTPException(status_code=404, detail="Run session not found or results not ready")
    vch_resp = ERPVoucherAgent.generate_vouchers_for_run(run_id=run_id, results=session.results)
    return Response(
        content=vch_resp.tally_batch_xml,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=reconx_tally_vouchers_{run_id}.xml"}
    )


@router.get("/run/{run_id}/disputes", response_model=DisputeListResponse)
def get_disputes(run_id: str):
    """
    Returns claims only when validated dispute rules support them; currently this endpoint abstains.
    """
    session = get_session(run_id)
    if not session or not session.results:
        raise HTTPException(status_code=404, detail="Run session not found or results not ready")
    return DisputeResolutionBot.generate_disputes_for_run(run_id=run_id, results=session.results)


@router.get("/run/{run_id}/statutory-dossier", response_model=StatutoryAuditDossier)
def get_statutory_dossier(run_id: str):
    """
    Generates a reconciliation run report. The legacy route name is retained.
    """
    session = get_session(run_id)
    if not session or not session.results:
        raise HTTPException(status_code=404, detail="Run session not found or results not ready")
    if not session.summary and session.orchestrator:
        session.summary = session.orchestrator.get_summary(run_id=run_id)
    return AuditDossierExporter.generate_dossier_for_run(
        summary=session.summary,
        results=session.results
    )


@router.get("/run/{run_id}/statutory-dossier/download")
def download_statutory_dossier(run_id: str):
    """
    Downloads a reconciliation run report as text. The legacy route name is retained.
    """
    session = get_session(run_id)
    if not session or not session.results:
        raise HTTPException(status_code=404, detail="Run session not found or results not ready")
    if not session.summary and session.orchestrator:
        session.summary = session.orchestrator.get_summary(run_id=run_id)
    dossier = AuditDossierExporter.generate_dossier_for_run(
        summary=session.summary,
        results=session.results
    )
    return Response(
        content=dossier.full_statutory_text,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=reconciliation_run_report_{run_id}.txt"}
    )
