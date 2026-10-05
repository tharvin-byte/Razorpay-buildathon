import json
from fastapi import APIRouter, HTTPException, Query, Response

from backend.services.run_service import get_session
from backend.services.export_service import build_report_display, build_transactions_csv

router = APIRouter(tags=["Reports & Exports"])


@router.get("/run/{run_id}/report")
def get_report(run_id: str):
    session = get_session(run_id)
    if not session or not session.summary:
        raise HTTPException(status_code=404, detail="Run session or summary not ready")

    return build_report_display(run_id=run_id, summary=session.summary, results=session.results)


@router.get("/run/{run_id}/report/download")
def download_report(run_id: str, format: str = Query("json", pattern="^(json|csv)$")):
    session = get_session(run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")

    if format == "json":
        if not session.summary:
            raise HTTPException(status_code=404, detail="Run summary not ready")
        report_data = build_report_display(run_id=run_id, summary=session.summary, results=session.results)
        return Response(
            content=json.dumps(report_data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=reconx_report_{run_id}.json"}
        )
    elif format == "csv":
        csv_str = build_transactions_csv(session.results)
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=reconx_results_{run_id}.csv"}
        )
