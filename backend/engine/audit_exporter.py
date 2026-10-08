from datetime import datetime
from typing import List, Dict, Any, Optional
from backend.models.schemas import (
    SummaryResponse, ReconciliationResult, StatutoryAuditDossier,
    EvaluationMetrics, ThresholdSweepPoint
)

class EvaluationHarness:
    """
    Evaluation Engine:
    Compares the reconciliation system output against the hidden Ground Truth mapping.
    """
    
    @staticmethod
    def evaluate(
        results: List[ReconciliationResult],
        ground_truth: List[Dict[str, Any]]
    ) -> EvaluationMetrics:
        gt_bank_map: Dict[str, Dict[str, Any]] = {}
        gt_ledger_map: Dict[str, Dict[str, Any]] = {}
        
        gt_total_matches = 0
        for entry in ground_truth:
            b_id = entry.get("bank_txn_id")
            l_ids = entry.get("ledger_entry_ids", [])
            
            if b_id:
                gt_bank_map[b_id] = entry
            for lid in l_ids:
                gt_ledger_map[lid] = entry
                
            if entry.get("expected_status") in ["matched_clean", "matched_with_discrepancy"]:
                gt_total_matches += 1

        correct_matches = 0
        false_positives = 0
        false_negatives = 0
        correct_exceptions = 0
        
        matched_count = 0
        discrepancy_count = 0
        exception_count = 0
        expected_non_match_count = 0
        
        for res in results:
            status = res.status
            rec_id = res.record_id
            
            if status == "matched_clean":
                matched_count += 1
            elif status == "matched_with_discrepancy":
                discrepancy_count += 1
                matched_count += 1
            elif status == "exception":
                exception_count += 1
            elif status == "expected_non_match":
                expected_non_match_count += 1
                
            gt_entry = None
            if res.source_type in ["bank", "batch"]:
                gt_entry = gt_bank_map.get(rec_id)
            elif res.source_type == "ledger":
                gt_entry = gt_ledger_map.get(rec_id)
                
            if not gt_entry:
                continue
                
            exp_status = gt_entry.get("expected_status")
            exp_ledger_ids = set(gt_entry.get("ledger_entry_ids", []))
            
            if status in ["matched_clean", "matched_with_discrepancy"]:
                actual_matched_ids = set()
                if res.matched_ledger_record:
                    actual_matched_ids.add(res.matched_ledger_record.ledger_entry_id)
                if res.matched_ledger_ids:
                    actual_matched_ids.update(res.matched_ledger_ids)
                    
                if exp_status in ["matched_clean", "matched_with_discrepancy"] and (actual_matched_ids & exp_ledger_ids or actual_matched_ids == exp_ledger_ids):
                    correct_matches += 1
                else:
                    false_positives += 1
                    
            elif status == "exception":
                if exp_status == "exception":
                    correct_exceptions += 1
                elif exp_status in ["matched_clean", "matched_with_discrepancy"]:
                    false_negatives += 1
                    
            elif status == "expected_non_match":
                if exp_status == "expected_non_match":
                    correct_exceptions += 1

        total = len(results)
        predicted_positives = correct_matches + false_positives
        actual_positives = gt_total_matches
        
        precision = round(correct_matches / predicted_positives, 4) if predicted_positives > 0 else 0.0
        recall = round(correct_matches / actual_positives, 4) if actual_positives > 0 else 0.0
        f1 = round(2 * (precision * recall) / (precision + recall), 4) if (precision + recall) > 0 else 0.0
        
        fp_rate = round(false_positives / (false_positives + correct_exceptions), 4) if (false_positives + correct_exceptions) > 0 else 0.0
        match_rate = round(matched_count / total, 4) if total > 0 else 0.0
        bank_results = [r for r in results if r.source_type in ("bank", "batch")]
        bank_matched = sum(
            1 for r in bank_results if r.status in ("matched_clean", "matched_with_discrepancy")
        )
        
        total_gt_orphans = sum(1 for g in ground_truth if g.get("is_orphan"))
        exception_acc = round(correct_exceptions / (total_gt_orphans + 1e-9), 4)
        exception_acc = min(1.0, exception_acc)
        
        return EvaluationMetrics(
            total_records=total,
            matched_count=matched_count,
            discrepancy_count=discrepancy_count,
            exception_count=exception_count,
            expected_non_match_count=expected_non_match_count,
            match_rate=match_rate,
            precision=precision,
            recall=recall,
            f1_score=f1,
            false_positive_rate=fp_rate,
            exception_accuracy=exception_acc,
            bank_record_count=len(bank_results),
            bank_matched_count=bank_matched,
            predicted_match_count=predicted_positives,
            labeled_match_count=actual_positives,
            precision_available=predicted_positives > 0,
            ground_truth_total_matches=gt_total_matches,
            correct_matches=correct_matches,
            false_positives=false_positives,
            false_negatives=false_negatives,
            correct_exceptions=correct_exceptions
        )

    @classmethod
    def sweep_thresholds(
        cls,
        bank_df,
        ledger_df,
        settlement_df,
        ground_truth: List[Dict[str, Any]],
        start: float = 0.55,
        end: float = 0.90,
        step: float = 0.05,
        base_results: Optional[List[ReconciliationResult]] = None
    ) -> List[ThresholdSweepPoint]:
        from backend.engine.orchestrator import ReconciliationOrchestrator
        
        if step <= 0 or end < start:
            raise ValueError("Threshold sweep requires step > 0 and end >= start")

        points: List[ThresholdSweepPoint] = []
        curr = start
        while curr <= end + 1e-5:
            thresh = round(curr, 2)

            # Re-run the assignment at each threshold: changing the threshold
            # can alter claims, batch choices, reverse-sweep rows and ambiguity.
            orch = ReconciliationOrchestrator(
                bank_df=bank_df,
                ledger_df=ledger_df,
                settlement_df=settlement_df,
                confidence_threshold=thresh,
                ground_truth=ground_truth
            )
            threshold_results = orch.run_pipeline()
            metrics = cls.evaluate(threshold_results, ground_truth)
            summary = orch.get_summary(run_id="threshold-sweep")
            
            points.append(
                ThresholdSweepPoint(
                    threshold=thresh,
                    precision=metrics.precision,
                    recall=metrics.recall,
                    f1_score=metrics.f1_score,
                    match_rate=metrics.match_rate,
                    bank_match_rate=summary.bank_match_rate,
                    false_positive_rate=metrics.false_positive_rate,
                    matched_count=metrics.matched_count,
                    exception_count=metrics.exception_count,
                    predicted_match_count=metrics.predicted_match_count,
                    labeled_match_count=metrics.labeled_match_count,
                    precision_available=metrics.precision_available
                )
            )
            curr += step
            
        return points


class AuditDossierExporter:
    """
    Builds a run report from reconciliation results and summary metrics.
    """

    @classmethod
    def generate_dossier_for_run(
        cls,
        summary: SummaryResponse,
        results: List[ReconciliationResult]
    ) -> StatutoryAuditDossier:
        now_str = datetime.now().strftime("%d-%B-%Y %H:%M:%S IST")
        fy = "Not specified"

        total_volume = sum(
            float(r.bank_record.amount) for r in results if r.bank_record
        )

        merkle_root = summary.merkle_root_hash or ""
        precision = summary.evaluation.precision if summary.evaluation else 0.0
        precision_available = bool(summary.evaluation and summary.evaluation.precision_available)
        precision_label = f"{precision*100:.1f}%" if precision_available else "Not available"
        is_solvency_certified = False

        schedule = {
            "TotalBankCredits": f"INR {total_volume:,.2f}",
            "VerifiedCleanMatches": summary.matched_clean_count,
            "MatchesWithVariance": summary.matched_discrepancy_count,
            "QuarantinedExceptions": summary.exception_bank_count + summary.exception_ledger_count,
            "ObservedPrecision": precision_label,
            "BankMatchRate": f"{summary.bank_match_rate*100:.1f}%",
            "MDRFeeLeakageVariance": summary.discrepancy_breakdown.get("fee_deduction", 0),
            "TimingLagsTPlus2": summary.discrepancy_breakdown.get("timing_lag", 0),
            "PartialRefundDeductions": summary.discrepancy_breakdown.get("partial_refund", 0)
        }

        full_text = f"""================================================================================
                      RECONCILIATION RUN REPORT
================================================================================

1. RUN DETAILS:
   - Run ID                    : {summary.run_id}
   - Generated At              : {now_str}
   - Reporting Period          : Not specified
   - Account                   : Not provided by source data

2. EXECUTIVE RECONCILIATION SUMMARY:
   - Total Bank Amount         : INR {total_volume:,.2f}
   - Bank Records              : {summary.total_bank_records}
   - Internal Ledger Rows      : {summary.total_ledger_records}
   - Bank Match Rate           : {summary.bank_match_rate*100:.1f}% ({summary.bank_matched_records} / {summary.total_bank_records} records)
   - Business Variance Matches : {summary.matched_discrepancy_count} records
   - Exception Records         : {summary.exception_bank_count + summary.exception_ledger_count} records

3. OBSERVED RUN METRICS (NOT A STATUTORY CERTIFICATION):
   - Observed Precision        : {precision_label}
   - Bank Match Rate           : {summary.bank_match_rate*100:.1f}%
   - Escrow Solvency Status    : Not assessed by this software

4. DISCREPANCY COUNTS:
   - Contractual MDR Fee Deductions : {summary.discrepancy_breakdown.get('fee_deduction', 0)} instances
   - Banking Settlement Timing Lags : {summary.discrepancy_breakdown.get('timing_lag', 0)} instances (T+1 to T+3)
   - Partial Customer Sales Returns : {summary.discrepancy_breakdown.get('partial_refund', 0)} instances
   - Paisa Rounding Differences     : {summary.discrepancy_breakdown.get('rounding_difference', 0)} instances

5. SHA-256 RESULT DIGEST:
   The result rows were hashed into a SHA-256 digest. This digest is not externally anchored:
   
   SHA-256 MERKLE ROOT:
   {merkle_root}
   
   This digest alone does not prove that source data was complete or unchanged after export.

================================================================================
Generated by ReconX. This document is an operational report, not an auditor attestation.
================================================================================"""

        return StatutoryAuditDossier(
            run_id=summary.run_id,
            attestation_date=now_str,
            financial_year=fy,
            nodal_escrow_account="Not provided by source data",
            total_settlement_volume=round(total_volume, 2),
            clean_match_rate=summary.match_rate,
            precision_rate=precision,
            total_discrepancies=summary.matched_discrepancy_count,
            total_exceptions=summary.exception_bank_count + summary.exception_ledger_count,
            merkle_root_hash=merkle_root,
            is_solvency_certified=is_solvency_certified,
            form_3cb_schedule=schedule,
            full_statutory_text=full_text
        )
