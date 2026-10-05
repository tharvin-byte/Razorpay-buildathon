from datetime import datetime
from typing import Dict, Any, List
import pandas as pd
from backend.models.schemas import ReconciliationResult, SummaryResponse


def escape_csv_formula_value(value: Any) -> Any:
    """Escapes strings starting with formula characters to prevent CSV injection."""
    if isinstance(value, str) and value.lstrip(" \t\r\n").startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def build_report_display(run_id: str, summary: SummaryResponse, results: List[ReconciliationResult]) -> Dict[str, Any]:
    """Builds a JSON report display dictionary from run summary and results."""
    s = summary
    return {
        "title": f"ReconX Reconciliation Run Report - Run {run_id}",
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "executive_summary": {
            "total_transactions": len(results),
            "match_rate": f"{s.match_rate * 100:.2f}%",
            "bank_match_rate": f"{s.bank_match_rate * 100:.2f}%",
            "ledger_coverage_rate": f"{s.ledger_coverage_rate * 100:.2f}%",
            "overall_resolution_rate": f"{s.overall_resolution_rate * 100:.2f}%",
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
            for r in results if r.source_type == "ledger" and r.status == "exception"
        ],
        "top_discrepancies": [
            {
                "bank_id": r.record_id,
                "ledger_id": r.matched_ledger_record.ledger_entry_id if r.matched_ledger_record else "",
                "amount": r.bank_record.amount if r.bank_record else 0,
                "explanation": r.explanation
            }
            for r in results if r.status == "matched_with_discrepancy"
        ][:10]
    }


def build_transactions_csv(results: List[ReconciliationResult]) -> str:
    """Exports all transaction reconciliation results as sanitized CSV."""
    rows = []
    for r in results:
        amount = 0.0
        if r.bank_record:
            amount = r.bank_record.amount
        elif r.matched_ledger_record:
            amount = r.matched_ledger_record.gross_amount

        matched_id = ""
        if r.matched_ledger_record:
            matched_id = r.matched_ledger_record.ledger_entry_id
        elif r.matched_ledger_ids:
            matched_id = ", ".join(r.matched_ledger_ids)

        rows.append({
            "record_id": r.record_id,
            "source_type": r.source_type,
            "status": r.status,
            "confidence_score": r.confidence_score,
            "amount": amount,
            "matched_ledger_id": matched_id,
            "discrepancies": "; ".join([d.type for d in r.discrepancies]),
            "explanation": r.explanation,
            "exception_side": r.exception_side or "",
            "exception_reason": r.exception_reason or ""
        })
    df = pd.DataFrame(rows)
    df = df.apply(lambda column: column.map(escape_csv_formula_value))
    return df.to_csv(index=False)
