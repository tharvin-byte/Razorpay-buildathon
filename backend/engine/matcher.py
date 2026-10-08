import pandas as pd
from typing import List, Dict, Any, Optional, Set
from backend.engine.scorer import ScoringTool, clean_str, clean_float
from backend.models.schemas import (
    ReconciliationResult, SignalBreakdown, DiscrepancyDetail,
    AgentTraceStep, LedgerRecord
)

def _clean_bank_dict(d: Dict[str, Any]) -> Dict[str, Any]:
    c = dict(d)
    c["bank_txn_id"] = clean_str(c.get("bank_txn_id", ""))
    c["date"] = clean_str(c.get("date", ""))
    c["amount"] = clean_float(c.get("amount", 0.0))
    c["type"] = clean_str(c.get("type", "credit")).lower() or "credit"
    c["counterparty_account"] = clean_str(c.get("counterparty_account", ""))
    c["narration"] = clean_str(c.get("narration", ""))
    c["utr_number"] = clean_str(c.get("utr_number", "")) or None
    return c

def _clean_ledger_dict(d: Dict[str, Any]) -> Dict[str, Any]:
    c = dict(d)
    c["ledger_entry_id"] = clean_str(c.get("ledger_entry_id", ""))
    c["order_id"] = clean_str(c.get("order_id", ""))
    c["merchant_id"] = clean_str(c.get("merchant_id", ""))
    c["expected_settlement_date"] = clean_str(c.get("expected_settlement_date", ""))
    c["gross_amount"] = clean_float(c.get("gross_amount", 0.0))
    c["razorpay_fee"] = clean_float(c.get("razorpay_fee", 0.0))
    c["refund_amount"] = clean_float(c.get("refund_amount", 0.0))
    c["counterparty_name"] = clean_str(c.get("counterparty_name", ""))
    c["invoice_ref"] = clean_str(c.get("invoice_ref", ""))
    st = clean_str(c.get("status", "settled")).lower()
    c["status"] = st if st in ("pending", "settled", "failed") else "settled"
    if "utr_number" in c:
        c["utr_number"] = clean_str(c.get("utr_number", "")) or None
    return c

class MatcherTool:
    """
    Deterministic candidate matching tool.
    Searches available candidate rows across internal ledger and settlement reports,
    evaluates multi-signal confidence scores, and enforces 1-to-1 claiming.
    """
    
    def __init__(
        self,
        ledger_df: pd.DataFrame,
        settlement_df: Optional[pd.DataFrame] = None,
        confidence_threshold: float = ScoringTool.DEFAULT_CONFIDENCE_THRESHOLD
    ):
        self.ledger_df = ledger_df.copy()
        # Convert ledger records to list of dicts for fast indexing
        self.ledger_records: List[Dict[str, Any]] = self.ledger_df.to_dict(orient="records")
        
        self.settlement_df = settlement_df.copy() if settlement_df is not None else None
        self.settlement_records: List[Dict[str, Any]] = (
            self.settlement_df.to_dict(orient="records") if self.settlement_df is not None else []
        )
        
        self.confidence_threshold = confidence_threshold
        
        # 1-to-1 Claiming Tracker: ledger_entry_id -> bank_txn_id
        self.claimed_ledger_map: Dict[str, str] = {}
        self.claimed_ledger_ids: Set[str] = set()
        
        # Build fast lookup indexes
        self.utr_to_ledger: Dict[str, List[Dict[str, Any]]] = {}
        self.inv_to_ledger: Dict[str, List[Dict[str, Any]]] = {}
        self.utr_to_settlement: Dict[str, List[Dict[str, Any]]] = {}
        
        self._build_indexes()
        
    def _build_indexes(self):
        for rec in self.ledger_records:
            # Failed gateway attempts cannot represent a settled bank credit.
            if clean_str(rec.get("status", "settled")).lower() == "failed":
                continue
            utr = clean_str(rec.get("utr_number", "")).upper()
            if utr:
                self.utr_to_ledger.setdefault(utr, []).append(rec)
                
            inv = clean_str(rec.get("invoice_ref", "")).upper()
            if inv:
                self.inv_to_ledger.setdefault(inv, []).append(rec)
                
        for srec in self.settlement_records:
            s_utr = clean_str(srec.get("utr_number", "")).upper()
            if s_utr:
                self.utr_to_settlement.setdefault(s_utr, []).append(srec)

    def find_candidates(
        self,
        bank_record: Dict[str, Any],
        extracted_name: str = "",
        extracted_ref: str = "",
        include_claimed: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Finds all candidate ledger records for a given bank record,
        computes their scores, and returns them sorted by score descending.
        """
        bank_utr = clean_str(bank_record.get("utr_number", "")).upper()
        
        candidates_seen: Set[str] = set()
        scored_candidates: List[Dict[str, Any]] = []
        
        # Strategy A: Exact UTR lookup (indexed; no full-pool scan on a safe hit)
        if bank_utr and bank_utr in self.utr_to_ledger:
            for l_rec in self.utr_to_ledger[bank_utr]:
                l_id = l_rec["ledger_entry_id"]
                if l_id not in candidates_seen:
                    candidates_seen.add(l_id)
                    score_res = ScoringTool.score_pair(
                        bank_record, l_rec, extracted_name, extracted_ref
                    )
                    is_claimed = l_id in self.claimed_ledger_ids
                    scored_candidates.append({
                        "ledger_record": l_rec,
                        "score": score_res["total_score"],
                        "signals": score_res["signals"],
                        "is_claimed": is_claimed,
                        "claimed_by": self.claimed_ledger_map.get(l_id)
                    })
                    
        # Strategy B: Exact reference lookup when narration parsing found a reference
        if extracted_ref and not bank_utr:
            ref_clean = clean_str(extracted_ref).upper()
            if ref_clean in self.inv_to_ledger:
                for l_rec in self.inv_to_ledger[ref_clean]:
                    l_id = l_rec["ledger_entry_id"]
                    if l_id not in candidates_seen:
                        candidates_seen.add(l_id)
                        score_res = ScoringTool.score_pair(
                            bank_record, l_rec, extracted_name, extracted_ref
                        )
                        is_claimed = l_id in self.claimed_ledger_ids
                        scored_candidates.append({
                            "ledger_record": l_rec,
                            "score": score_res["total_score"],
                            "signals": score_res["signals"],
                            "is_claimed": is_claimed,
                            "claimed_by": self.claimed_ledger_map.get(l_id)
                        })

        # A supplied exact identifier is an identity constraint, not merely a
        # scoring feature. Never broaden a failed UTR/reference lookup into a
        # scan that could claim an unrelated row.
        if not bank_utr and not (extracted_ref and extracted_ref.upper() in self.inv_to_ledger):
            for l_rec in self.ledger_records:
                if clean_str(l_rec.get("status", "settled")).lower() == "failed":
                    continue
                l_id = l_rec["ledger_entry_id"]
                if l_id in candidates_seen:
                    continue

                score_res = ScoringTool.score_pair(bank_record, l_rec, extracted_name, extracted_ref)
                score = score_res["total_score"]
                if score >= 0.25:
                    candidates_seen.add(l_id)
                    scored_candidates.append({
                        "ledger_record": l_rec,
                        "score": score,
                        "signals": score_res["signals"],
                        "is_claimed": l_id in self.claimed_ledger_ids,
                        "claimed_by": self.claimed_ledger_map.get(l_id)
                    })

        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        
        if not include_claimed:
            scored_candidates = [c for c in scored_candidates if not c["is_claimed"]]
            
        return scored_candidates

    def find_settlement_record(self, utr: str, inv_ref: str) -> Optional[Dict[str, Any]]:
        """
        Finds matching network settlement report row if available.
        """
        if not self.settlement_records:
            return None
            
        utr_clean = clean_str(utr).upper()
        if utr_clean and utr_clean in self.utr_to_settlement:
            return self.utr_to_settlement[utr_clean][0]
            
        inv_clean = clean_str(inv_ref).upper()
        if inv_clean:
            for srec in self.settlement_records:
                if clean_str(srec.get("merchant_order_ref", "")).upper() == inv_clean:
                    return srec
        return None

    def claim_ledger_row(self, ledger_id: str, bank_txn_id: str) -> bool:
        """
        Attempts to claim a ledger row for a bank transaction (1-to-1 enforcement).
        Returns True if claim succeeded, False if already claimed.
        """
        if ledger_id in self.claimed_ledger_ids:
            return False
        self.claimed_ledger_ids.add(ledger_id)
        self.claimed_ledger_map[ledger_id] = bank_txn_id
        return True

    def get_unclaimed_ledger_records(self) -> List[Dict[str, Any]]:
        """
        Returns all ledger records that have not been claimed by any bank transaction.
        """
        return [
            rec for rec in self.ledger_records
            if rec["ledger_entry_id"] not in self.claimed_ledger_ids
        ]


class BatchSettlementTool:
    """Conservative batch gate.

    The current source models do not contain a batch identifier or authoritative
    membership relation from a settlement row to its ledger legs. Amount sums
    and shared UTRs are insufficient to establish many-to-one identity.
    """

    ROUNDING_TOLERANCE = 1.00

    @classmethod
    def check_batch_settlement(
        cls,
        bank_record: Dict[str, Any],
        matcher: MatcherTool
    ) -> Optional[ReconciliationResult]:
        return None

class ReverseSweepTool:
    """
    Phase B: Reverse Sweep Engine.
    Examines all unclaimed internal ledger rows after the bank forward pass.
    """
    
    @staticmethod
    def run(unclaimed_ledger_records: List[Dict[str, Any]]) -> List[ReconciliationResult]:
        reverse_results: List[ReconciliationResult] = []
        
        for l_rec in unclaimed_ledger_records:
            l_id = l_rec.get("ledger_entry_id", "")
            status = l_rec.get("status", "pending")
            gross = float(l_rec.get("gross_amount", 0.0))
            counterparty = l_rec.get("counterparty_name", "Unknown")
            inv_ref = l_rec.get("invoice_ref", "N/A")
            exp_date = l_rec.get("expected_settlement_date", "")
            
            trace_steps = [
                AgentTraceStep(
                    step_num=1,
                    agent_name="Decision Maker",
                    action="Reverse Sweep Inspection",
                    input_summary=f"Unclaimed ledger entry {l_id} (₹{gross:.2f}, status: '{status}')",
                    output_summary="Evaluating status and claim trail",
                    reasoning="Ledger row was not claimed by any bank statement credit in forward pass."
                )
            ]
            
            # Case 1: Status is 'failed' -> Expected Non-Match
            if status.lower() == "failed":
                trace_steps.append(
                    AgentTraceStep(
                        step_num=2,
                        agent_name="Discrepancy Agent",
                        action="Classify Expected Non-Match",
                        input_summary=f"Ledger status is 'failed'",
                        output_summary="Classified as expected_non_match",
                        reasoning="Payment gateway recorded this transaction as failed. Absence of bank credit is expected and verified."
                    )
                )
                
                exp_text = (
                    f"DIAGNOSIS:\n"
                    f"Expected Failed Checkout Non-Match (Order {inv_ref})\n\n"
                    f"ROOT CAUSE:\n"
                    f"Customer {counterparty} attempted Order {inv_ref} ({l_id}), but the payment gateway transaction status "
                    f"was recorded as 'FAILED' on {exp_date}. As expected, zero nodal bank deposit was disbursed.\n\n"
                    f"FINANCIAL BREAKDOWN:\n"
                    f"Attempted Order Amount : ₹{gross:,.2f}\n"
                    f"Gateway Settlement Net : ₹0.00 [FAILED CHECKOUT]\n"
                    f"Bank Inflow Received   : ₹0.00 [100% EXPECTED PARITY]\n\n"
                    f"STATUS & ACTION:\n"
                    f"Resolution Status : Auto-Verified Expected Non-Match\n"
                    f"Controller Action : Void pending order in ERP. No bank dispute required.\n\n"
                    f"AUDIT PROOF:\n"
                    f"Gateway status '{status}' cross-verified against zero nodal bank ledger."
                )
                
                res = ReconciliationResult(
                    record_id=l_id,
                    source_type="ledger",
                    bank_record=None,
                    matched_ledger_record=LedgerRecord(**_clean_ledger_dict(l_rec)),
                    status="expected_non_match",
                    confidence_score=1.0,
                    signals=SignalBreakdown(
                        total_score=1.0,
                        details={"note": "Failed transaction correctly did not produce a bank settlement credit"}
                    ),
                    discrepancies=[
                        DiscrepancyDetail(
                            type="status_mismatch",
                            description=f"Transaction failed at gateway on {exp_date}. No bank credit expected.",
                            impact_amount=0.0
                        )
                    ],
                    explanation=exp_text,
                    exception_side=None,
                    exception_reason=None,
                    trace=trace_steps
                )
                reverse_results.append(res)
                
            # Case 2: Status is 'pending' or 'settled' -> Genuine Ledger-Side Orphan Exception
            else:
                fee = float(l_rec.get("razorpay_fee", 0.0))
                expected_net = max(0.0, gross - fee)
                order_id = l_rec.get("order_id", "N/A")
                
                trace_steps.append(
                    AgentTraceStep(
                        step_num=2,
                        agent_name="Discrepancy Agent",
                        action="Flag Ledger Orphan Exception",
                        input_summary=f"Ledger status is '{status}', gross: ₹{gross:.2f}",
                        output_summary="Flagged as exception (ledger-side orphan)",
                        reasoning="Money was captured in internal ledger but no corresponding nodal bank credit was found."
                    )
                )
                
                exp_text = (
                    f"DIAGNOSIS:\n"
                    f"Missing Inflow Disbursal (Ledger-Side Orphan Exception · Expected ₹{expected_net:,.2f})\n\n"
                    f"ROOT CAUSE:\n"
                    f"Internal sales order {order_id} ({inv_ref}, Customer: {counterparty}) captured ₹{gross:,.2f} in merchant "
                    f"ERP ledger, but zero corresponding settlement credit was deposited into the HDFC nodal bank account.\n\n"
                    f"FINANCIAL BREAKDOWN:\n"
                    f"Internal Order Gross   : ₹{gross:,.2f}\n"
                    f"(-) Estimated MDR Fee  : -₹{fee:,.2f}\n"
                    f"Expected Bank Deposit  : ₹{expected_net:,.2f}\n"
                    f"Actual Bank Credit     : ₹0.00 [UNSETTLED CAPITAL EXPOSURE: ₹{expected_net:,.2f}]\n\n"
                    f"STATUS & ACTION:\n"
                    f"Resolution Status : Quarantined in Capital Exposure Watchlist\n"
                    f"Controller Action : Initiate 1-Click Bank Dispute Claim to recover stranded settlement funds from gateway.\n\n"
                    f"AUDIT PROOF:\n"
                    f"Ledger record {l_id} was not matched because available evidence was insufficient."
                )
                
                res = ReconciliationResult(
                    record_id=l_id,
                    source_type="ledger",
                    bank_record=None,
                    matched_ledger_record=LedgerRecord(**_clean_ledger_dict(l_rec)),
                    status="exception",
                    confidence_score=0.0,
                    signals=SignalBreakdown(
                        total_score=0.0,
                        details={"note": "No corresponding bank credit found across statement records"}
                    ),
                    discrepancies=[
                        DiscrepancyDetail(
                            type="unreconciled_amount_gap",
                            description=f"Missing bank deposit of ₹{gross:.2f} for ledger {l_id}",
                            impact_amount=gross
                        )
                    ],
                    explanation=exp_text,
                    exception_side="ledger",
                    exception_reason=f"Missing bank settlement of ₹{expected_net:,.2f} for internal ledger order {order_id}.",
                    trace=trace_steps
                )
                reverse_results.append(res)
                
        return reverse_results
