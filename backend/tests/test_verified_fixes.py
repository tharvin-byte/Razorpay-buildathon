import pandas as pd

from backend.engine.matcher import BatchSettlementTool, MatcherTool
from backend.engine.agents.decision_maker_agent import DecisionMakerAgent
from backend.engine.scorer import ScoringTool
from backend.engine.audit_exporter import EvaluationHarness


def _ledger(ledger_id, amount, utr="UTR-BATCH", status="settled"):
    return {
        "ledger_entry_id": ledger_id,
        "order_id": f"order-{ledger_id}",
        "merchant_id": "merchant-1",
        "expected_settlement_date": "2026-03-01",
        "gross_amount": amount,
        "razorpay_fee": 0.0,
        "refund_amount": 0.0,
        "counterparty_name": "Test Merchant",
        "invoice_ref": ledger_id,
        "status": status,
        "utr_number": utr,
    }


def test_exact_utr_candidate_does_not_scan_unrelated_ledger(monkeypatch):
    records = [
        _ledger("L1", 100.0),
        _ledger("L2", 700.0, utr="OTHER-UTR"),
    ]
    matcher = MatcherTool(pd.DataFrame(records))
    original = ScoringTool.score_pair
    calls = []

    def tracked(*args, **kwargs):
        calls.append(args[1]["ledger_entry_id"])
        return original(*args, **kwargs)

    monkeypatch.setattr(ScoringTool, "score_pair", tracked)
    candidates = matcher.find_candidates({
        "bank_txn_id": "B1", "amount": 100.0, "utr_number": "UTR-BATCH",
        "narration": "UPI/TEST/INV-L1", "date": "2026-03-01"
    })

    assert [c["ledger_record"]["ledger_entry_id"] for c in candidates] == ["L1"]
    assert calls == ["L1"]


def test_exact_utr_miss_does_not_fall_back_to_unrelated_rows():
    matcher = MatcherTool(pd.DataFrame([_ledger("L1", 100.0, utr="OTHER-UTR")]))
    assert matcher.find_candidates({
        "bank_txn_id": "B1", "amount": 100.0, "utr_number": "BANK-UTR",
        "narration": "UPI/TEST/L1", "date": "2026-03-01"
    }) == []


def test_exact_reference_conflict_is_not_overridden_by_fuzzy_candidates():
    rows = [_ledger("L1", 100.0), _ledger("L2", 100.0)]
    rows[0]["invoice_ref"] = "INV-EXACT"
    rows[1]["invoice_ref"] = "OTHER-REF"
    matcher = MatcherTool(pd.DataFrame(rows))
    found = matcher.find_candidates(
        {"bank_txn_id": "B1", "amount": 100.0, "narration": "INV-EXACT", "date": "2026-03-01"},
        extracted_ref="INV-EXACT"
    )
    assert [c["ledger_record"]["ledger_entry_id"] for c in found] == ["L1"]


def test_duplicate_exact_utr_abstains_even_when_candidate_scores_differ():
    rows = [_ledger("L1", 100.0), _ledger("L2", 500.0)]
    rows[0]["invoice_ref"] = "INV-EXACT"
    rows[1]["invoice_ref"] = "OTHER-REF"
    matcher = MatcherTool(pd.DataFrame(rows))
    agent = DecisionMakerAgent(matcher, confidence_threshold=0.70)
    result = agent.process_bank_record({
        "bank_txn_id": "B1", "date": "2026-03-01", "amount": 100.0,
        "type": "credit", "counterparty_account": "", "utr_number": "UTR-BATCH",
        "narration": "UPI/TEST/INV-EXACT",
    })
    assert result.status == "exception"
    assert result.matched_ledger_record is None
    assert not matcher.claimed_ledger_ids


def test_duplicate_exact_reference_abstains_without_utr_even_when_scores_differ():
    rows = [_ledger("L1", 100.0, utr=""), _ledger("L2", 500.0, utr="")]
    rows[0]["invoice_ref"] = "INV-EXACT"
    rows[1]["invoice_ref"] = "INV-EXACT"
    matcher = MatcherTool(pd.DataFrame(rows))
    agent = DecisionMakerAgent(matcher, confidence_threshold=0.70)
    result = agent.process_bank_record({
        "bank_txn_id": "B1", "date": "2026-03-01", "amount": 100.0,
        "type": "credit", "counterparty_account": "", "utr_number": "",
        "narration": "UPI/TEST/INV-EXACT",
    })
    assert result.status == "exception"
    assert result.matched_ledger_record is None
    assert not matcher.claimed_ledger_ids


def test_batch_match_abstains_without_authoritative_batch_identity():
    rows = [_ledger("L1", 30.0), _ledger("L2", 70.0), _ledger("L3", 500.0, utr="OTHER")]
    matcher = MatcherTool(pd.DataFrame(rows))
    result = BatchSettlementTool.check_batch_settlement(
        {"bank_txn_id": "B1", "amount": 100.0, "utr_number": "UTR-BATCH"}, matcher
    )

    assert result is None
    assert not matcher.claimed_ledger_ids


def test_batch_match_abstains_on_multiple_sum_solutions():
    rows = [_ledger("L1", 40.0), _ledger("L2", 60.0), _ledger("L3", 50.0), _ledger("L4", 50.0)]
    matcher = MatcherTool(pd.DataFrame(rows))
    result = BatchSettlementTool.check_batch_settlement(
        {"bank_txn_id": "B1", "amount": 100.0, "utr_number": "UTR-BATCH"}, matcher
    )

    assert result is None
    assert not matcher.claimed_ledger_ids


def test_batch_match_abstains_without_settlement_rows_or_bank_utr():
    rows = [_ledger("L1", 30.0), _ledger("L2", 70.0)]
    matcher = MatcherTool(pd.DataFrame(rows), settlement_df=None)
    assert BatchSettlementTool.check_batch_settlement(
        {"bank_txn_id": "B1", "amount": 100.0, "utr_number": "UTR-BATCH"}, matcher
    ) is None
    assert BatchSettlementTool.check_batch_settlement(
        {"bank_txn_id": "B1", "amount": 100.0}, matcher
    ) is None


def test_batch_collision_abstains_without_claiming_any_ledger():
    rows = [_ledger("L1", 50.0), _ledger("L2", 50.0), _ledger("L3", 50.0)]
    matcher = MatcherTool(pd.DataFrame(rows))
    assert BatchSettlementTool.check_batch_settlement(
        {"bank_txn_id": "B1", "amount": 100.0, "utr_number": "UTR-BATCH"}, matcher
    ) is None
    assert not matcher.claimed_ledger_ids


def test_failed_ledger_rows_are_not_match_candidates():
    matcher = MatcherTool(pd.DataFrame([_ledger("L1", 100.0, status="failed")]))
    candidates = matcher.find_candidates({
        "bank_txn_id": "B1", "amount": 100.0, "utr_number": "UTR-BATCH",
        "narration": "UPI/TEST/INV-L1", "date": "2026-03-01"
    })

    assert candidates == []


def test_threshold_sweep_runs_a_fresh_pipeline_for_each_threshold(monkeypatch):
    import backend.engine.orchestrator as orchestrator_module

    observed = []

    class FakeOrchestrator:
        def __init__(self, **kwargs):
            observed.append(kwargs["confidence_threshold"])

        def run_pipeline(self):
            return []

        def get_summary(self, run_id=None):
            from unittest.mock import MagicMock
            mock_s = MagicMock()
            mock_s.bank_match_rate = 0.0
            return mock_s

    monkeypatch.setattr(orchestrator_module, "ReconciliationOrchestrator", FakeOrchestrator)
    points = EvaluationHarness.sweep_thresholds(
        pd.DataFrame(), pd.DataFrame(), None,
        [{"bank_txn_id": "B1", "ledger_entry_ids": ["L1"], "expected_status": "matched_clean"}],
        start=0.55, end=0.65, step=0.05,
        base_results=[]
    )

    assert observed == [0.55, 0.6, 0.65]
    assert [point.threshold for point in points] == [0.55, 0.6, 0.65]


def test_precision_is_unavailable_when_no_matches_were_predicted():
    metrics = EvaluationHarness.evaluate([], [{
        "bank_txn_id": "B1",
        "ledger_entry_ids": ["L1"],
        "expected_status": "matched_clean",
    }])
    assert metrics.predicted_match_count == 0
    assert metrics.labeled_match_count == 1
    assert metrics.precision_available is False


def test_date_signal_rejects_antecedent_deposit():
    score, desc = ScoringTool.calculate_date_signal("2026-03-01", "2026-03-03")
    assert score == 0.0
    assert "precedes ledger date" in desc


def test_evaluation_metrics_precision_zero_division():
    metrics = EvaluationHarness.evaluate([], [])
    assert metrics.precision == 0.0
    assert metrics.recall == 0.0


def test_rounding_gain_voucher_double_entry_orientation():
    from backend.engine.agents.erp_voucher_agent import ERPVoucherAgent
    from backend.models.schemas import BankRecord, LedgerRecord, ReconciliationResult, DiscrepancyDetail

    res = ReconciliationResult(
        record_id="B_GAIN",
        source_type="bank",
        bank_record=BankRecord(
            bank_txn_id="B_GAIN", date="2026-03-01", amount=100.50, type="credit",
            counterparty_account="", narration="UPI/GAIN", utr_number="UTR_GAIN",
        ),
        matched_ledger_record=LedgerRecord(
            ledger_entry_id="L_GAIN", order_id="O1", merchant_id="M1",
            expected_settlement_date="2026-03-01", gross_amount=100.0,
            razorpay_fee=0.0, refund_amount=0.0, counterparty_name="Merchant",
            invoice_ref="INV_GAIN", status="settled",
        ),
        status="matched_with_discrepancy",
        confidence_score=0.9,
        signals={},
        discrepancies=[DiscrepancyDetail(
            type="rounding_difference", description="Unallocated credit variance", impact_amount=0.50
        )],
        explanation="test gain",
    )
    resp = ERPVoucherAgent.generate_vouchers_for_run("R_GAIN", [res])
    assert len(resp.vouchers) == 1
    v = resp.vouchers[0]
    assert v.is_balanced
    rv = next(e for e in v.entries if e.account_code == "4090")
    assert rv.credit_amount == 0.50
    assert rv.debit_amount == 0.0
    sc = next(e for e in v.entries if e.account_code == "1020")
    assert sc.debit_amount == 0.50
    assert sc.credit_amount == 0.0


def test_reference_formatting_case_insensitive_detection():
    from backend.engine.agents.discrepancy_agent import DiscrepancyDecompositionAgent

    bank = {"bank_txn_id": "B1", "narration": "UPI/inv-2026-001/settlement", "amount": 100.0}
    ledger = {"invoice_ref": "INV-2026-001", "gross_amount": 100.0, "razorpay_fee": 0.0, "refund_amount": 0.0}
    disc = DiscrepancyDecompositionAgent.analyze_matched_pair(bank, ledger)
    rf = next((d for d in disc if d.type == "reference_formatting"), None)
    assert rf is not None
    assert "Reference string case variation" in rf.description

