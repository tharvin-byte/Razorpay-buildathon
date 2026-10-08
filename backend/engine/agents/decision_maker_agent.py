from typing import Dict, Any, List, Optional
from backend.models.schemas import (
    ReconciliationResult, SignalBreakdown, DiscrepancyDetail,
    AgentTraceStep, BankRecord, LedgerRecord, SettlementRecord
)
from backend.engine.scorer import clean_str, clean_float
from backend.engine.matcher import MatcherTool, BatchSettlementTool
from backend.engine.agents.narration_parser_agent import NarrationParserAgent
from backend.engine.agents.discrepancy_agent import DiscrepancyDecompositionAgent
from backend.engine.conformal_verifier import MerkleAuditTree

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

def _clean_settle_dict(d: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not d:
        return None
    c = dict(d)
    c["network_settlement_id"] = clean_str(c.get("network_settlement_id", ""))
    c["settlement_batch_date"] = clean_str(c.get("settlement_batch_date", ""))
    c["payment_method"] = clean_str(c.get("payment_method", "UPI")) or "UPI"
    c["gross_amount"] = clean_float(c.get("gross_amount", 0.0))
    c["network_fee"] = clean_float(c.get("network_fee", 0.0))
    c["net_amount"] = clean_float(c.get("net_amount", 0.0))
    c["merchant_order_ref"] = clean_str(c.get("merchant_order_ref", ""))
    c["utr_number"] = clean_str(c.get("utr_number", "")) or None
    return c

class DecisionMakerAgent:
    """
    Decision Maker & Planner Agent (Autonomous Triage & Matching Coordinator):
    Conducts multi-tiered routing:
    1. Fast-Path O(1) Deterministic UTR Lookup (~65% traffic)
    2. Multi-Signal Scoring Engine (Exact reference, fuzzy string, amount delta, date proximity)
    3. Ambiguity Quarantine & Conflict Detection (Zero-Guessing policy)
    """
    
    def __init__(self, matcher: MatcherTool, confidence_threshold: float = 0.75):
        self.matcher = matcher
        self.confidence_threshold = confidence_threshold
        self.narration_agent = NarrationParserAgent()

    def process_bank_record(self, bank_record: Dict[str, Any]) -> ReconciliationResult:
        bank_record = dict(bank_record)
        bank_txn_id = clean_str(bank_record.get("bank_txn_id", ""))
        bank_amt = clean_float(bank_record.get("amount", 0.0))
        bank_utr = clean_str(bank_record.get("utr_number", "")).upper()
        narration = clean_str(bank_record.get("narration", ""))
        
        bank_record["bank_txn_id"] = bank_txn_id
        bank_record["amount"] = bank_amt
        bank_record["utr_number"] = bank_utr or None
        bank_record["narration"] = narration
        
        trace: List[AgentTraceStep] = []
        
        # -------------------------------------------------------------
        # Step 1: Zero-Signal Triage Early Exit
        # -------------------------------------------------------------
        if not bank_utr and not narration:
            trace.append(
                AgentTraceStep(
                    step_num=1,
                    agent_name="Planner Agent",
                    action="Zero-Signal Early Exit",
                    input_summary=f"Bank Txn {bank_txn_id} has no UTR and empty narration",
                    output_summary="Immediately marked as exception",
                    reasoning="Zero identifying signals available. Abstained from guessing."
                )
            )
            exp_text = (
                f"DIAGNOSIS:\n"
                f"Zero-Signal Inflow Anomaly (Unidentifiable Bank Credit ₹{bank_amt:,.2f})\n\n"
                f"ROOT CAUSE:\n"
                f"Bank record {bank_txn_id} was received with neither a UTR settlement reference nor any narration string. "
                f"Lacks statutory metadata required to associate with an internal merchant order.\n\n"
                f"FINANCIAL BREAKDOWN:\n"
                f"Unidentified Bank Inflow : ₹{bank_amt:,.2f}\n"
                f"Identified Ledger Amount : ₹0.00 [ZERO SIGNAL METADATA]\n"
                f"Unallocated Variance Gap : ₹{bank_amt:,.2f}\n\n"
                f"STATUS & ACTION:\n"
                f"Resolution Status : Quarantined in Suspense Account (AML Compliance)\n"
                f"Controller Action : Issue inquiry to acquiring bank clearing desk for remitter attribution.\n\n"
                f"AUDIT PROOF:\n"
                f"Bank transaction {bank_txn_id} was left unmatched because available evidence was insufficient."
            )
            return ReconciliationResult(
                record_id=bank_txn_id,
                source_type="bank",
                bank_record=BankRecord(**bank_record),
                matched_ledger_record=None,
                status="exception",
                confidence_score=0.0,
                signals=SignalBreakdown(total_score=0.0),
                discrepancies=[
                    DiscrepancyDetail(type="unreconciled_amount_gap", description="Zero identifying metadata in bank record", impact_amount=bank_amt)
                ],
                explanation=exp_text,
                exception_side="bank",
                exception_reason="Zero metadata signals available for matching.",
                trace=trace
            )

        # -------------------------------------------------------------
        # Step 2: Has UTR? Route A: Fast Deterministic Path O(1)
        # -------------------------------------------------------------
        if bank_utr and bank_utr not in ("NONE", "NULL", "NAN", ""):
            trace.append(
                AgentTraceStep(
                    step_num=1,
                    agent_name="Planner Agent",
                    action="Fast UTR Lookup (Route A)",
                    input_summary=f"Bank Txn {bank_txn_id}, UTR: {bank_utr}",
                    output_summary="Queried Matcher with exact UTR index",
                    reasoning="UTR present; executing deterministic O(1) candidate lookup."
                )
            )
            
            candidates = self.matcher.find_candidates(bank_record)
            # If a UTR indexes several ledger legs, test the uniquely linked
            # batch before the single-row fast path can claim only one leg.
            batch_res = BatchSettlementTool.check_batch_settlement(bank_record, self.matcher)
            if batch_res:
                return batch_res
            if candidates:
                top_cand = candidates[0]
                l_rec = top_cand["ledger_record"]
                score = top_cand["score"]
                is_claimed = top_cand["is_claimed"]
                
                # A shared exact UTR does not identify an individual ledger leg.
                # Without an authoritative membership key, abstain even when one
                # candidate happens to score higher than another.
                exact_candidates_ambiguous = len(candidates) > 1
                if score >= self.confidence_threshold and not exact_candidates_ambiguous:
                    if not is_claimed:
                        self.matcher.claim_ledger_row(l_rec["ledger_entry_id"], bank_txn_id)
                        
                        settle_rec = self.matcher.find_settlement_record(bank_utr, l_rec.get("invoice_ref", ""))
                        discrepancies = DiscrepancyDecompositionAgent.analyze_matched_pair(bank_record, l_rec, settle_rec)
                        
                        match_status = "matched_with_discrepancy" if discrepancies else "matched_clean"
                        explanation = DiscrepancyDecompositionAgent.compose_explanation(bank_record, l_rec, score, discrepancies)
                        
                        leaf_hash = MerkleAuditTree._hash_leaf({
                            "bank_id": bank_txn_id,
                            "ledger_id": l_rec["ledger_entry_id"],
                            "amount": bank_amt,
                            "utr": bank_utr,
                            "status": match_status
                        })

                        signals_dict = top_cand["signals"].copy()
                        signals_dict["merkle_leaf_hash"] = leaf_hash
                        signals_dict["cardinality_type"] = "1:1"

                        trace.append(
                            AgentTraceStep(
                                step_num=2,
                                agent_name="Discrepancy Agent",
                                action="Resolve Matched Pair (Route A)",
                                input_summary=f"Matched Ledger {l_rec['ledger_entry_id']} (Score: {score:.4f})",
                                output_summary=f"Status: {match_status}, Discrepancies: {len(discrepancies)}",
                                reasoning=f"High-confidence match via UTR ({score*100:.1f}%). Ledger row successfully claimed."
                            )
                        )
                        
                        return ReconciliationResult(
                            record_id=bank_txn_id,
                            source_type="bank",
                            bank_record=BankRecord(**bank_record),
                            matched_ledger_record=LedgerRecord(**_clean_ledger_dict(l_rec)),
                            matched_settlement_record=SettlementRecord(**_clean_settle_dict(settle_rec)) if settle_rec else None,
                            status=match_status,
                            confidence_score=score,
                            signals=SignalBreakdown(**signals_dict),
                            discrepancies=discrepancies,
                            explanation=explanation,
                            trace=trace
                        )
                    else:
                        trace.append(
                            AgentTraceStep(
                                step_num=2,
                                agent_name="Conflict Detector",
                                action="Detect Duplicate Conflict",
                                input_summary=f"Ledger {l_rec['ledger_entry_id']} already claimed by {top_cand.get('claimed_by')}",
                                output_summary="Flagged as duplicate exception",
                                reasoning="1-to-1 claiming prevented double-counting."
                            )
                        )
                        exc_reason = DiscrepancyDecompositionAgent.compose_exception_reason(bank_record, top_cand)
                        return ReconciliationResult(
                            record_id=bank_txn_id,
                            source_type="bank",
                            bank_record=BankRecord(**bank_record),
                            status="exception",
                            confidence_score=score,
                            signals=SignalBreakdown(**top_cand["signals"]),
                            discrepancies=[DiscrepancyDetail(type="duplicate_retry", description="Target ledger entry already claimed", impact_amount=bank_amt)],
                            explanation=exc_reason,
                            exception_side="bank",
                            exception_reason="Duplicate bank transaction against already-claimed ledger record.",
                            trace=trace
                        )

        # -------------------------------------------------------------
        # Step 3: No UTR or UTR Miss -> Route B: 3D Tensor & Narration Extraction
        # -------------------------------------------------------------
        trace.append(
            AgentTraceStep(
                step_num=len(trace) + 1,
                agent_name="Narration Parser Agent",
                action="Extract Unstructured Narration & Subwords",
                input_summary=f"Narration: '{narration}'",
                output_summary="Extracted entity and reference metadata via subwords",
                reasoning="UTR missing or unresolved. Executing subword character vector parsing."
            )
        )
        
        extracted_data, narr_reason = self.narration_agent.parse(narration)
        extracted_name = extracted_data.get("extracted_name", "")
        extracted_ref = extracted_data.get("extracted_ref", "")
        
        trace.append(
            AgentTraceStep(
                step_num=len(trace) + 1,
                agent_name="Matcher",
                action="Multi-Signal Candidate Search",
                input_summary=f"Extracted: Name='{extracted_name}', Ref='{extracted_ref}'",
                output_summary="Evaluated weighted matching signals",
                reasoning=narr_reason
            )
        )
        
        candidates = self.matcher.find_candidates(
            bank_record,
            extracted_name=extracted_name,
            extracted_ref=extracted_ref
        )
        
        if candidates:
            top_cand = candidates[0]
            l_rec = top_cand["ledger_record"]
            score = top_cand["score"]
            is_claimed = top_cand["is_claimed"]
            
            is_ambiguous = False
            if len(candidates) > 1:
                second_score = candidates[1]["score"]
                if score >= self.confidence_threshold and (score - second_score) < 0.08 and second_score > 0.65:
                    is_ambiguous = True

            top_signals = top_cand.get("signals", {})
            has_bank_utr = bool(bank_utr and bank_utr not in ("NONE", "NULL", "NAN"))
            shared_utr_conflict = has_bank_utr and len(candidates) > 1
            exact_reference_conflict = (
                not has_bank_utr
                and len(candidates) > 1
                and bool(clean_str(extracted_ref))
                and clean_str(extracted_ref).upper() in self.matcher.inv_to_ledger
            )
            if shared_utr_conflict or exact_reference_conflict:
                is_ambiguous = True
            no_utr_evidence_sufficient = (
                (top_signals.get("invoice_ref_match", 0.0) >= 0.85
                 and top_signals.get("amount_match", 0.0) >= 0.5)
                or (top_signals.get("counterparty_name_sim", 0.0) >= 0.95
                    and top_signals.get("amount_match", 0.0) >= 1.0
                    and top_signals.get("date_proximity", 0.0) >= 0.85)
            )
            evidence_sufficient = has_bank_utr or no_utr_evidence_sufficient
                    
            if score >= self.confidence_threshold and evidence_sufficient and not is_ambiguous:
                if not is_claimed:
                    self.matcher.claim_ledger_row(l_rec["ledger_entry_id"], bank_txn_id)
                    settle_rec = self.matcher.find_settlement_record(l_rec.get("utr_number", ""), l_rec.get("invoice_ref", ""))
                    discrepancies = DiscrepancyDecompositionAgent.analyze_matched_pair(bank_record, l_rec, settle_rec)
                    
                    match_status = "matched_with_discrepancy" if discrepancies else "matched_clean"
                    explanation = DiscrepancyDecompositionAgent.compose_explanation(bank_record, l_rec, score, discrepancies)
                    
                    leaf_hash = MerkleAuditTree._hash_leaf({
                        "bank_id": bank_txn_id,
                        "ledger_id": l_rec["ledger_entry_id"],
                        "amount": bank_amt,
                        "utr": l_rec.get("utr_number", ""),
                        "status": match_status
                    })

                    signals_dict = top_cand["signals"].copy()
                    signals_dict["merkle_leaf_hash"] = leaf_hash
                    signals_dict["cardinality_type"] = "1:1"

                    trace.append(
                        AgentTraceStep(
                            step_num=len(trace) + 1,
                            agent_name="Discrepancy Agent",
                            action="Resolve Matched Pair via Scoring Engine",
                            input_summary=f"Matched Ledger {l_rec['ledger_entry_id']} (Score: {score:.4f})",
                            output_summary=f"Status: {match_status}",
                            reasoning=f"Resolved via multi-signal extraction and weighted scoring ({score*100:.1f}%)."
                        )
                    )
                    
                    return ReconciliationResult(
                        record_id=bank_txn_id,
                        source_type="bank",
                        bank_record=BankRecord(**bank_record),
                        matched_ledger_record=LedgerRecord(**_clean_ledger_dict(l_rec)),
                        matched_settlement_record=SettlementRecord(**_clean_settle_dict(settle_rec)) if settle_rec else None,
                        status=match_status,
                        confidence_score=score,
                        signals=SignalBreakdown(**signals_dict),
                        discrepancies=discrepancies,
                        explanation=explanation,
                        trace=trace
                    )
            elif is_ambiguous:
                trace.append(
                    AgentTraceStep(
                        step_num=len(trace) + 1,
                        agent_name="Conflict Detector",
                        action="Zero-Guessing Ambiguity Quarantine",
                        input_summary=f"Top scores: {score:.3f} vs {candidates[1]['score']:.3f}",
                        output_summary="Flagged as honest exception (ambiguous)",
                        reasoning="Multiple candidate records remain unresolved under the available identity evidence. Refused to guess."
                    )
                )
                ambiguity_cause = (
                    "The exact bank UTR maps to multiple ledger rows, and the current source model has no authoritative settlement-member key."
                    if shared_utr_conflict else
                    "The exact extracted reference maps to multiple ledger rows, and the available source fields do not identify one ledger entry."
                    if exact_reference_conflict else
                    "Multiple candidates have insufficient score separation under the configured ambiguity rule."
                )
                exc_reason = (
                    "DIAGNOSIS:\nAmbiguous Candidate Conflict\n\n"
                    f"ROOT CAUSE:\n{ambiguity_cause}\n\n"
                    "STATUS & ACTION:\nHeld for review. No ledger record was claimed. Review source references and provide an authoritative batch-member relationship if this represents a multi-row settlement."
                )
                return ReconciliationResult(
                    record_id=bank_txn_id,
                    source_type="bank",
                    bank_record=BankRecord(**bank_record),
                    status="exception",
                    confidence_score=score,
                    signals=SignalBreakdown(**top_cand["signals"]),
                    discrepancies=[DiscrepancyDetail(type="candidate_ambiguity", description=ambiguity_cause, impact_amount=0.0)],
                    explanation=exc_reason,
                    exception_side="bank",
                    exception_reason=ambiguity_cause,
                    trace=trace
                )

        # -------------------------------------------------------------
        # Step 4: Route C: Batch Settlement & Graph Netting (N:1, 1:N)
        # -------------------------------------------------------------
        batch_res = BatchSettlementTool.check_batch_settlement(bank_record, self.matcher)
        if batch_res:
            return batch_res

        # -------------------------------------------------------------
        # Step 5: True Bank Orphan Exception
        # -------------------------------------------------------------
        best_cand = candidates[0] if candidates else None
        exc_reason = DiscrepancyDecompositionAgent.compose_exception_reason(bank_record, best_cand, reason_hint="No corresponding transaction found.")
        
        trace.append(
            AgentTraceStep(
                step_num=len(trace) + 1,
                agent_name="Discrepancy Agent",
                action="Flag Bank Orphan Exception",
                input_summary=f"Bank Txn {bank_txn_id} (₹{bank_amt:.2f})",
                output_summary="Classified as exception (bank orphan)",
                reasoning="No candidate ledger entry met confidence threshold or batch criteria."
            )
        )
        
        return ReconciliationResult(
            record_id=bank_txn_id,
            source_type="bank",
            bank_record=BankRecord(**bank_record),
            status="exception",
            confidence_score=best_cand["score"] if best_cand else 0.0,
            signals=SignalBreakdown(**best_cand["signals"]) if best_cand else SignalBreakdown(total_score=0.0),
            discrepancies=[DiscrepancyDetail(type="unreconciled_amount_gap", description="Unreconciled bank deposit with no ledger counterpart", impact_amount=bank_amt)],
            explanation=exc_reason,
            exception_side="bank",
            exception_reason="Unreconciled bank deposit without matching ledger record.",
            trace=trace
        )

# Backward compatibility alias
DecisionMaker = DecisionMakerAgent
