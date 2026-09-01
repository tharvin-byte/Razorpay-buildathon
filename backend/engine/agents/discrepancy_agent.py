from datetime import datetime
from typing import Dict, Any, List, Optional
from backend.models.schemas import DiscrepancyDetail

class DiscrepancyDecompositionAgent:
    """
    Discrepancy & Root-Cause Decomposition Agent:
    1. Analyzes matched bank-ledger pairs to identify exact business root causes for differences
       (MDR fees, timing lags, partial refunds, rounding, reference variations, duplicate retries).
    2. Composes precise, auditor-grade plain-language explanations.
    3. Produces honest, detailed exception reasons for unresolved bank/ledger records.
    """
    
    ROUNDING_TOLERANCE = 1.00 # ₹1.00
    
    @classmethod
    def analyze_matched_pair(
        cls,
        bank_record: Dict[str, Any],
        ledger_record: Dict[str, Any],
        settlement_record: Optional[Dict[str, Any]] = None
    ) -> List[DiscrepancyDetail]:
        discrepancies: List[DiscrepancyDetail] = []
        
        bank_amt = float(bank_record.get("amount", 0.0))
        gross_amt = float(ledger_record.get("gross_amount", 0.0))
        fee = float(ledger_record.get("razorpay_fee", 0.0))
        refund = float(ledger_record.get("refund_amount", 0.0))
        
        expected_net = round(gross_amt - fee - refund, 2)
        amt_diff = round(bank_amt - expected_net, 2)
        
        # 1. Partial Refund Check
        if refund > 0.0:
            discrepancies.append(
                DiscrepancyDetail(
                    type="partial_refund",
                    description=f"Partial customer refund of ₹{refund:.2f} deducted from gross amount prior to settlement.",
                    impact_amount=refund
                )
            )
            
        # 2. Amount Gap Check (Fee Deduction vs Rounding)
        if abs(amt_diff) > 0.0:
            if abs(amt_diff) <= cls.ROUNDING_TOLERANCE:
                discrepancies.append(
                    DiscrepancyDetail(
                        type="rounding_difference",
                        description=f"Minor paisa rounding variance of ₹{abs(amt_diff):.2f} between bank credit and ledger net.",
                        impact_amount=abs(amt_diff)
                    )
                )
            else:
                discrepancies.append(
                    DiscrepancyDetail(
                        type="fee_deduction",
                        description=f"Fee gap of ₹{abs(amt_diff):.2f} (bank credit ₹{bank_amt:.2f} vs ledger expected net ₹{expected_net:.2f}, recorded fee: ₹{fee:.2f}).",
                        impact_amount=abs(amt_diff)
                    )
                )
                
        # 3. Timing Lag Check
        bank_date_str = str(bank_record.get("date", ""))[:10]
        ledger_date_str = str(ledger_record.get("expected_settlement_date", ""))[:10]
        
        if bank_date_str and ledger_date_str and bank_date_str != ledger_date_str:
            try:
                d_bank = datetime.strptime(bank_date_str, "%Y-%m-%d")
                d_ledger = datetime.strptime(ledger_date_str, "%Y-%m-%d")
                days_lag = (d_bank - d_ledger).days
                
                if days_lag != 0:
                    sign_desc = f"T+{days_lag}" if days_lag > 0 else f"T{days_lag}"
                    discrepancies.append(
                        DiscrepancyDetail(
                            type="timing_lag",
                            description=f"Settlement batch timing lag of {abs(days_lag)} day(s) ({sign_desc}): ledger expected {ledger_date_str}, bank settled {bank_date_str}.",
                            days_lag=days_lag
                        )
                    )
            except Exception:
                pass
                
        # 4. Reference Formatting Check
        bank_narration = str(bank_record.get("narration", ""))
        inv_ref = str(ledger_record.get("invoice_ref", ""))
        if inv_ref and inv_ref in bank_narration and inv_ref != inv_ref.upper():
            discrepancies.append(
                DiscrepancyDetail(
                    type="reference_formatting",
                    description=f"Reference string case/format variation ('{inv_ref}' matched in narration).",
                    impact_amount=0.0
                )
            )

        return discrepancies

    @classmethod
    def compose_explanation(
        cls,
        bank_record: Dict[str, Any],
        ledger_record: Dict[str, Any],
        confidence_score: float,
        discrepancies: List[DiscrepancyDetail]
    ) -> str:
        bank_id = bank_record.get("bank_txn_id", "")
        ledger_id = ledger_record.get("ledger_entry_id", "")
        name = ledger_record.get("counterparty_name", "Counterparty")
        inv = ledger_record.get("invoice_ref", "N/A")
        bank_amt = float(bank_record.get("amount", 0.0))
        
        if not discrepancies:
            return (
                f"CLEAN MATCH (Score {confidence_score*100:.1f}%): Bank credit {bank_id} (₹{bank_amt:.2f}) "
                f"perfectly reconciles with Ledger {ledger_id} for {name} ({inv}). "
                f"UTR and amount verified without discrepancies."
            )
            
        disc_summaries = "; ".join([d.description for d in discrepancies])
        return (
            f"RECONCILED WITH DISCREPANCIES (Score {confidence_score*100:.1f}%): "
            f"Bank credit {bank_id} matched Ledger {ledger_id} ({name}, {inv}). "
            f"Business variances identified: {disc_summaries}."
        )

    @classmethod
    def compose_exception_reason(
        cls,
        bank_record: Dict[str, Any],
        best_candidate: Optional[Dict[str, Any]] = None,
        reason_hint: str = ""
    ) -> str:
        bank_id = bank_record.get("bank_txn_id", "")
        bank_amt = float(bank_record.get("amount", 0.0))
        narration = bank_record.get("narration", "None")
        utr = bank_record.get("utr_number", "None")
        
        if best_candidate and best_candidate.get("is_claimed"):
            claimed_by = best_candidate.get("claimed_by", "another bank transaction")
            cand_id = best_candidate["ledger_record"]["ledger_entry_id"]
            return (
                f"HONEST EXCEPTION (Duplicate Conflict): Nearest candidate ledger entry {cand_id} was already claimed by {claimed_by}. "
                f"Bank record {bank_id} (₹{bank_amt:.2f}) flagged as duplicate/unclaimed credit."
            )
            
        if best_candidate and best_candidate.get("score", 0) > 0.3:
            cand_id = best_candidate["ledger_record"]["ledger_entry_id"]
            score = best_candidate["score"]
            return (
                f"HONEST EXCEPTION (Ambiguous/Low Confidence {score*100:.1f}%): Insufficient evidence to safely claim ledger entry {cand_id}. "
                f"Bank deposit {bank_id} (₹{bank_amt:.2f}, UTR: {utr}) requires manual finance controller review."
            )
            
        return (
            f"HONEST EXCEPTION (Bank Orphan): Bank credit {bank_id} for ₹{bank_amt:.2f} (Narration: '{narration}') "
            f"has no matching internal ledger or settlement record. {reason_hint}"
        )

# Backward compatibility alias
ReportWriter = DiscrepancyDecompositionAgent
