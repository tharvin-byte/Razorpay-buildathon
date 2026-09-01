import pytest
import pandas as pd
import json
from backend.engine.data_generator import SyntheticDataGenerator
from backend.engine.scorer import ScoringTool
from backend.engine.matcher import MatcherTool
from backend.engine.orchestrator import ReconciliationOrchestrator
from backend.engine.audit_exporter import EvaluationHarness

def test_synthetic_data_generation():
    gen = SyntheticDataGenerator(seed=101)
    df_bank, df_ledger, df_settle, gt = gen.generate_batch(total_bank_records=60)
    
    assert len(df_bank) == 60
    assert len(df_ledger) >= 60
    assert len(gt) >= 60
    assert "bank_txn_id" in df_bank.columns
    assert "ledger_entry_id" in df_ledger.columns
    assert "network_settlement_id" in df_settle.columns

def test_exact_utr_scoring():
    bank_rec = {
        "bank_txn_id": "BNK-001",
        "amount": 4900.0,
        "utr_number": "UTR999888777",
        "narration": "UPI/RAMESH/9876543210/INV100",
        "date": "2026-03-01"
    }
    ledger_rec = {
        "ledger_entry_id": "LEDG-001",
        "gross_amount": 5000.0,
        "razorpay_fee": 100.0,
        "refund_amount": 0.0,
        "counterparty_name": "Ramesh Kumar",
        "invoice_ref": "INV100",
        "order_id": "ord_100",
        "utr_number": "UTR999888777",
        "expected_settlement_date": "2026-03-01"
    }
    
    score_res = ScoringTool.score_pair(bank_rec, ledger_rec)
    assert score_res["total_score"] >= 0.95
    assert score_res["signals"]["utr_match"] == 1.0
    assert score_res["signals"]["amount_match"] == 1.0

def test_missing_utr_fuzzy_scoring():
    bank_rec = {
        "bank_txn_id": "BNK-002",
        "amount": 2940.0,
        "utr_number": "",
        "narration": "UPI/PRIYASHARMA/9876543210/INV500",
        "date": "2026-03-02"
    }
    ledger_rec = {
        "ledger_entry_id": "LEDG-002",
        "gross_amount": 3000.0,
        "razorpay_fee": 60.0,
        "refund_amount": 0.0,
        "counterparty_name": "Priya Sharma",
        "invoice_ref": "INV500",
        "order_id": "ord_500",
        "utr_number": "",
        "expected_settlement_date": "2026-03-02"
    }
    
    score_res = ScoringTool.score_pair(
        bank_rec, ledger_rec,
        extracted_name="PRIYA SHARMA",
        extracted_ref="INV500"
    )
    # Ref match (0.25) + Name match (0.15) + Amount match (0.10) + Date (0.05) = 0.55
    assert score_res["total_score"] >= 0.50
    assert score_res["signals"]["invoice_ref_match"] == 1.0
    assert score_res["signals"]["counterparty_name_sim"] >= 0.9

def test_full_reconciliation_pipeline():
    gen = SyntheticDataGenerator(seed=42)
    df_bank, df_ledger, df_settle, gt = gen.generate_batch(total_bank_records=70)
    
    orch = ReconciliationOrchestrator(
        bank_df=df_bank,
        ledger_df=df_ledger,
        settlement_df=df_settle,
        confidence_threshold=0.75,
        ground_truth=gt
    )
    
    results = orch.run_pipeline()
    assert len(results) >= len(df_bank)
    
    summary = orch.get_summary()
    assert summary.match_rate > 0.70
    assert summary.evaluation is not None
    assert summary.evaluation.precision >= 0.90
    assert summary.evaluation.recall >= 0.85
    assert summary.evaluation.exception_accuracy >= 0.80
    
    # Check that reverse sweep caught ledger orphans
    ledger_orphans = [r for r in results if r.source_type == "ledger" and r.status == "exception"]
    assert len(ledger_orphans) >= 2
    
    # Check that failed status ledger entries were flagged as expected non-matches
    expected_non_matches = [r for r in results if r.status == "expected_non_match"]
    assert len(expected_non_matches) >= 1
