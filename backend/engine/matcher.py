import itertools
import pandas as pd
from typing import List, Dict, Any, Optional, Set, Tuple
from backend.engine.scorer import ScoringTool
from backend.models.schemas import (
    ReconciliationResult, SignalBreakdown, DiscrepancyDetail,
    AgentTraceStep, BankRecord, LedgerRecord
)

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
            utr = str(rec.get("utr_number", "")).strip().upper()
            if utr and utr != "NAN":
                self.utr_to_ledger.setdefault(utr, []).append(rec)
                
            inv = str(rec.get("invoice_ref", "")).strip().upper()
            if inv and inv != "NAN":
                self.inv_to_ledger.setdefault(inv, []).append(rec)
                
        for srec in self.settlement_records:
            s_utr = str(srec.get("utr_number", "")).strip().upper()
            if s_utr and s_utr != "NAN":
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
        bank_utr = str(bank_record.get("utr_number", "")).strip().upper()
        
        candidates_seen: Set[str] = set()
        scored_candidates: List[Dict[str, Any]] = []
        
        # Strategy A: Exact UTR lookup (Instant O(1))
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
                    
        # Strategy B: Exact/Fuzzy Ref lookup if extracted_ref is known
        if extracted_ref:
            ref_clean = extracted_ref.strip().upper()
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

        # Strategy C: Full pool scan (for fuzzy matching when no exact UTR/ref hit)
        for l_rec in self.ledger_records:
            l_id = l_rec["ledger_entry_id"]
            if l_id in candidates_seen:
                continue
                
            score_res = ScoringTool.score_pair(
                bank_record, l_rec, extracted_name, extracted_ref
            )
            score = score_res["total_score"]
            if score >= 0.25:
                candidates_seen.add(l_id)
                is_claimed = l_id in self.claimed_ledger_ids
                scored_candidates.append({
                    "ledger_record": l_rec,
                    "score": score,
                    "signals": score_res["signals"],
                    "is_claimed": is_claimed,
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
            
        utr_clean = (utr or "").strip().upper()
        if utr_clean and utr_clean in self.utr_to_settlement:
            return self.utr_to_settlement[utr_clean][0]
            
        inv_clean = (inv_ref or "").strip().upper()
        if inv_clean:
            for srec in self.settlement_records:
                if str(srec.get("merchant_order_ref", "")).strip().upper() == inv_clean:
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
    """
    Phase C: Batch Settlement Check (Many-to-One Reconciliation).
    For bank records that remain unmatched after Phase A, checks if the lump bank amount
    equals the combined net sum of 2 or 3 unclaimed ledger entries.
    """
    
    ROUNDING_TOLERANCE = 1.00 # ₹1.00
    
    @classmethod
    def check_batch_settlement(
        cls,
        bank_record: Dict[str, Any],
        matcher: MatcherTool
    ) -> Optional[ReconciliationResult]:
        bank_amt = float(bank_record.get("amount", 0.0))
        bank_txn_id = bank_record.get("bank_txn_id", "")
        
        unclaimed = matcher.get_unclaimed_ledger_records()
        if len(unclaimed) < 2:
            return None
            
        candidates_with_net = []
        for l in unclaimed:
            gross = float(l.get("gross_amount", 0.0))
            fee = float(l.get("razorpay_fee", 0.0))
            refund = float(l.get("refund_amount", 0.0))
            net = round(gross - fee - refund, 2)
            candidates_with_net.append((l, net))
            
        # Check combinations of 2
        for combo in itertools.combinations(candidates_with_net, 2):
            total_net = round(combo[0][1] + combo[1][1], 2)
            if abs(total_net - bank_amt) <= cls.ROUNDING_TOLERANCE:
                matched_ledger_recs = [combo[0][0], combo[1][0]]
                return cls._create_batch_result(bank_record, matched_ledger_recs, total_net, matcher)
                
        # Check combinations of 3
        if len(candidates_with_net) >= 3:
            for combo in itertools.combinations(candidates_with_net, 3):
                total_net = round(combo[0][1] + combo[1][1] + combo[2][1], 2)
                if abs(total_net - bank_amt) <= cls.ROUNDING_TOLERANCE:
                    matched_ledger_recs = [combo[0][0], combo[1][0], combo[2][0]]
                    return cls._create_batch_result(bank_record, matched_ledger_recs, total_net, matcher)
                    
        return None

    @classmethod
    def _create_batch_result(
        cls,
        bank_record: Dict[str, Any],
        matched_ledger_recs: List[Dict[str, Any]],
        total_net: float,
        matcher: MatcherTool
    ) -> ReconciliationResult:
        bank_txn_id = bank_record.get("bank_txn_id", "")
        bank_amt = float(bank_record.get("amount", 0.0))
        
        matched_ids = [l["ledger_entry_id"] for l in matched_ledger_recs]
        for lid in matched_ids:
            matcher.claim_ledger_row(lid, bank_txn_id)
            
        ledger_summaries = ", ".join([
            f"{l['ledger_entry_id']} (₹{float(l['gross_amount']) - float(l['razorpay_fee']):.2f})"
            for l in matched_ledger_recs
        ])
        
        trace = [
            AgentTraceStep(
                step_num=1,
                agent_name="Decision Maker",
                action="Trigger Batch Settlement Check",
                input_summary=f"Unmatched bank credit {bank_txn_id} of ₹{bank_amt:.2f}",
                output_summary=f"Found exact 2-3 item sum match across unclaimed ledger pool",
                reasoning=f"Sum of net expected amounts across {len(matched_ids)} ledger rows equals lump bank deposit."
            ),
            AgentTraceStep(
                step_num=2,
                agent_name="Discrepancy Agent",
                action="Document Batch Discrepancy",
                input_summary=f"Matched ledger entries: {matched_ids}",
                output_summary="Classified as matched_with_discrepancy (batch_settlement)",
                reasoning="Many-to-one batch payout confirmed by bank netting."
            )
        ]
        
        return ReconciliationResult(
            record_id=bank_txn_id,
            source_type="batch",
            bank_record=BankRecord(**bank_record),
            matched_ledger_record=LedgerRecord(**matched_ledger_recs[0]),
            matched_ledger_ids=matched_ids,
            status="matched_with_discrepancy",
            confidence_score=0.92,
            signals=SignalBreakdown(
                amount_match=1.0,
                total_score=0.92,
                details={
                    "batch_match": f"Lump sum ₹{bank_amt:.2f} matches {len(matched_ids)} entries ({ledger_summaries})"
                }
            ),
            discrepancies=[
                DiscrepancyDetail(
                    type="batch_settlement",
                    description=f"Many-to-one batch payout: {len(matched_ids)} ledger transactions consolidated into single lump credit of ₹{bank_amt:.2f}.",
                    impact_amount=bank_amt
                )
            ],
            explanation=f"BATCH SETTLEMENT RESOLVED: Bank credit {bank_txn_id} (₹{bank_amt:.2f}) represents a consolidated payout for {len(matched_ids)} ledger transactions: {ledger_summaries}.",
            trace=trace
        )


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
                
                res = ReconciliationResult(
                    record_id=l_id,
                    source_type="ledger",
                    bank_record=None,
                    matched_ledger_record=LedgerRecord(**l_rec),
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
                    explanation=f"Ledger entry {l_id} ({counterparty}, {inv_ref}) has status 'failed'. Verified that no bank settlement was received, which matches expected gateway behavior.",
                    exception_side=None,
                    exception_reason=None,
                    trace=trace_steps
                )
                reverse_results.append(res)
                
            # Case 2: Status is 'pending' or 'settled' -> Genuine Ledger-Side Orphan Exception
            else:
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
                
                res = ReconciliationResult(
                    record_id=l_id,
                    source_type="ledger",
                    bank_record=None,
                    matched_ledger_record=LedgerRecord(**l_rec),
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
                    explanation=f"CRITICAL LEDGER ORPHAN: Ledger entry {l_id} expects ₹{gross:.2f} for order {l_rec.get('order_id', 'N/A')} ({counterparty}, {inv_ref}), but no matching credit was received in the bank statement.",
                    exception_side="ledger",
                    exception_reason=f"Money expected (₹{gross:.2f}) but never received in bank nodal account.",
                    trace=trace_steps
                )
                reverse_results.append(res)
                
        return reverse_results
