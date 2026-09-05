import pandas as pd
from typing import List, Dict, Any, Optional, Callable
from backend.models.schemas import (
    ReconciliationResult, SummaryResponse, EvaluationMetrics,
    BankRecord, LedgerRecord, SettlementRecord
)
from backend.engine.matcher import MatcherTool, ReverseSweepTool
from backend.engine.scorer import ScoringTool
from backend.engine.agents.decision_maker_agent import DecisionMakerAgent, DecisionMaker
from backend.engine.audit_exporter import EvaluationHarness
from backend.engine.conformal_verifier import MerkleAuditTree, ConformalRiskVerifier

def _sanitize_df(df: Optional[pd.DataFrame]) -> Optional[pd.DataFrame]:
    if df is None or not isinstance(df, pd.DataFrame):
        return df
    clean = df.copy()
    for col in clean.columns:
        if clean[col].dtype == object or pd.api.types.is_string_dtype(clean[col]):
            clean[col] = clean[col].apply(lambda x: "" if (pd.isna(x) or str(x).strip().lower() in ("nan", "none", "null")) else str(x).strip())
        elif pd.api.types.is_numeric_dtype(clean[col]):
            clean[col] = clean[col].fillna(0.0)
    return clean

class ReconciliationOrchestrator:
    """
    Core Pipeline Orchestrator (Next-Gen Neuro-Symbolic):
    Executes multi-phase reconciliation across bank, ledger, and settlement sources.
    Integrates 3D Multi-Signal Hybrid Tensors, Bipartite Graph Netting,
    Stanford Conformal Risk Control (CRC), and Cryptographic Merkle Attestation.
    """
    
    def __init__(
        self,
        bank_df: pd.DataFrame,
        ledger_df: pd.DataFrame,
        settlement_df: Optional[pd.DataFrame] = None,
        confidence_threshold: float = ScoringTool.DEFAULT_CONFIDENCE_THRESHOLD,
        ground_truth: Optional[List[Dict[str, Any]]] = None
    ):
        self.bank_df = _sanitize_df(bank_df)
        self.ledger_df = _sanitize_df(ledger_df)
        self.settlement_df = _sanitize_df(settlement_df) if settlement_df is not None else None
        self.confidence_threshold = confidence_threshold
        self.ground_truth = ground_truth
        
        self.matcher = MatcherTool(
            ledger_df=self.ledger_df,
            settlement_df=self.settlement_df,
            confidence_threshold=self.confidence_threshold
        )
        self.decision_maker = DecisionMaker(
            matcher=self.matcher,
            confidence_threshold=self.confidence_threshold
        )
        
        self.conformal_verifier = ConformalRiskVerifier(target_alpha=0.001)
        self.merkle_root: Optional[str] = None
        self.calibrated_threshold: Optional[float] = None
        self.results: List[ReconciliationResult] = []
        self.is_completed = False
        
    def run_pipeline(
        self,
        progress_callback: Optional[Callable[[int, int, str, str], None]] = None
    ) -> List[ReconciliationResult]:
        """
        Runs Phase A (Forward Bank Pass), Phase B (Reverse Sweep), and computes Merkle Tree Attestation.
        """
        all_results: List[ReconciliationResult] = []
        bank_records = self.bank_df.to_dict(orient="records")
        total_bank = len(bank_records)
        
        # -------------------------------------------------------------
        # Phase A: Forward Pass (Bank Statement Records via Tensor Core)
        # -------------------------------------------------------------
        for idx, b_rec in enumerate(bank_records):
            if progress_callback:
                progress_callback(
                    idx + 1,
                    total_bank,
                    "Planner Agent",
                    b_rec.get("bank_txn_id", "")
                )
                
            res = self.decision_maker.process_bank_record(b_rec)
            all_results.append(res)
            
        # -------------------------------------------------------------
        # Phase B: Reverse Sweep (Unclaimed Ledger Records & Capital Loss)
        # -------------------------------------------------------------
        if progress_callback:
            progress_callback(
                total_bank,
                total_bank,
                "Reverse Sweep Engine",
                "Inspecting unclaimed ledger rows"
            )
            
        unclaimed_ledger = self.matcher.get_unclaimed_ledger_records()
        reverse_results = ReverseSweepTool.run(unclaimed_ledger)
        all_results.extend(reverse_results)
        
        self.results = all_results
        
        # -------------------------------------------------------------
        # Phase C: Cryptographic Merkle Root & Conformal Risk Calibration
        # -------------------------------------------------------------
        reconciled_dicts = []
        conf_scores = []
        
        # Ground-Truth Binding: If independent ground_truth is provided (e.g. synthetic benchmarks),
        # extract genuine labels. NEVER derive labels circularly from r.status!
        gt_is_match_map = {}
        if self.ground_truth:
            for g in self.ground_truth:
                b_id = g.get("bank_txn_id")
                if b_id:
                    # True positive if ground-truth expected clean match or discrepancy match
                    gt_is_match_map[b_id] = g.get("expected_status") in ("matched_clean", "matched_with_discrepancy")

        ground_truth_labels = [] if self.ground_truth else None

        for r in self.results:
            conf_scores.append(r.confidence_score)
            b_id = r.bank_record.bank_txn_id if r.bank_record else r.record_id
            
            if ground_truth_labels is not None:
                # Genuine independent label from ground truth; defaults to False if unmapped/orphan
                ground_truth_labels.append(gt_is_match_map.get(b_id, False))

            reconciled_dicts.append({
                "bank_id": b_id,
                "ledger_id": r.matched_ledger_record.ledger_entry_id if r.matched_ledger_record else "",
                "amount": r.bank_record.amount if r.bank_record else 0.0,
                "utr": r.bank_record.utr_number if r.bank_record else "",
                "status": r.status
            })

        self.merkle_root = MerkleAuditTree.build_merkle_root(reconciled_dicts)
        
        if ground_truth_labels is not None:
            self.calibrated_threshold = self.conformal_verifier.calibrate_threshold(
                calibration_confidence_scores=conf_scores,
                ground_truth_labels=ground_truth_labels,
                default_fallback=self.confidence_threshold
            )
        else:
            # Unlabelled real-world run: cannot calculate independent conformal risk without labels
            self.calibrated_threshold = None

        self.is_completed = True
        return self.results

    def get_summary(self, run_id: str = "run_default") -> SummaryResponse:
        """
        Computes executive KPI summary, discrepancy breakdown, and cryptographic attestation.
        """
        matched_clean = 0
        matched_disc = 0
        exc_bank = 0
        exc_ledger = 0
        expected_non_match = 0
        
        disc_breakdown: Dict[str, int] = {
            "fee_deduction": 0,
            "timing_lag": 0,
            "partial_refund": 0,
            "rounding_difference": 0,
            "batch_settlement": 0,
            "reference_formatting": 0,
            "duplicate_retry": 0,
            "unreconciled_amount_gap": 0,
            "status_mismatch": 0
        }
        
        for r in self.results:
            if r.status == "matched_clean":
                matched_clean += 1
            elif r.status == "matched_with_discrepancy":
                matched_disc += 1
            elif r.status == "exception":
                if r.exception_side == "bank":
                    exc_bank += 1
                else:
                    exc_ledger += 1
            elif r.status == "expected_non_match":
                expected_non_match += 1
                
            for d in r.discrepancies:
                if d.type in disc_breakdown:
                    disc_breakdown[d.type] += 1

        total_txns = len(self.results)
        match_rate = round((matched_clean + matched_disc) / total_txns, 4) if total_txns > 0 else 0.0
        
        eval_metrics = None
        if self.ground_truth:
            eval_metrics = EvaluationHarness.evaluate(self.results, self.ground_truth)
            
        return SummaryResponse(
            run_id=run_id,
            total_bank_records=len(self.bank_df),
            total_ledger_records=len(self.ledger_df),
            total_settlement_records=len(self.settlement_df) if self.settlement_df is not None else 0,
            matched_clean_count=matched_clean,
            matched_discrepancy_count=matched_disc,
            exception_bank_count=exc_bank,
            exception_ledger_count=exc_ledger,
            expected_non_match_count=expected_non_match,
            match_rate=match_rate,
            discrepancy_breakdown=disc_breakdown,
            current_threshold=self.confidence_threshold,
            merkle_root_hash=self.merkle_root,
            conformal_calibrated_threshold=self.calibrated_threshold,
            evaluation=eval_metrics
        )
