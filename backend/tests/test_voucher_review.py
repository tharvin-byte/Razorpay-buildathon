import pytest

from backend.engine.agents.erp_voucher_agent import ERPVoucherAgent
from backend.models.schemas import (
    BankRecord, DiscrepancyDetail, LedgerRecord, ReconciliationResult,
)


def _result(discrepancy_type, amount=10.0):
    return ReconciliationResult(
        record_id="B1",
        source_type="bank",
        bank_record=BankRecord(
            bank_txn_id="B1", date="2026-03-01", amount=100.0, type="credit",
            counterparty_account="", narration="", utr_number="UTR1",
        ),
        matched_ledger_record=LedgerRecord(
            ledger_entry_id="L1", order_id="O1", merchant_id="M1",
            expected_settlement_date="2026-03-01", gross_amount=100.0,
            razorpay_fee=1.5, refund_amount=amount, counterparty_name="Merchant",
            invoice_ref="INV1", status="settled",
        ),
        status="matched_with_discrepancy",
        confidence_score=0.9,
        signals={},
        discrepancies=[DiscrepancyDetail(
            type=discrepancy_type, description="test variance", impact_amount=amount
        )],
        explanation="test",
    )


@pytest.mark.parametrize("kind", ["fee_deduction", "unreconciled_amount_gap", "batch_settlement", "status_mismatch"])
def test_unsupported_accounting_types_are_review_only_and_not_exported(kind):
    response = ERPVoucherAgent.generate_vouchers_for_run("R1", [_result(kind)])
    assert response.vouchers == []
    assert response.manual_review_items[0]["record_id"] == "B1"
    assert "<VOUCHER" not in response.tally_batch_xml


@pytest.mark.parametrize("kind", ["partial_refund", "rounding_difference"])
def test_supported_accounting_types_produce_balanced_export(kind):
    response = ERPVoucherAgent.generate_vouchers_for_run("R1", [_result(kind)])
    assert len(response.vouchers) == 1
    voucher = response.vouchers[0]
    assert voucher.is_balanced
    assert voucher.total_debit == voucher.total_credit
    assert "<VOUCHER" in response.tally_batch_xml
    assert response.manual_review_items == []


@pytest.mark.parametrize("kind", ["timing_lag", "reference_formatting", "duplicate_retry", "rounding_difference", "partial_refund", "batch_settlement", "fee_deduction", "unreconciled_amount_gap", "status_mismatch", "none"])
def test_every_discrepancy_type_is_either_reviewed_or_explicitly_accounted(kind):
    response = ERPVoucherAgent.generate_vouchers_for_run("R1", [_result(kind)])
    if kind in {"partial_refund", "rounding_difference"}:
        assert len(response.vouchers) == 1
        assert response.vouchers[0].is_balanced
    elif kind in {"fee_deduction", "unreconciled_amount_gap", "batch_settlement", "status_mismatch", "duplicate_retry"}:
        assert response.manual_review_items
        assert response.vouchers == []
    else:
        assert response.vouchers == []


def test_unattributed_bank_exception_is_not_automatically_posted_to_suspense():
    result = ReconciliationResult(
        record_id="ORPHAN-1", source_type="bank",
        bank_record=BankRecord(
            bank_txn_id="ORPHAN-1", date="2026-03-01", amount=75.0,
            type="credit", counterparty_account="", narration="", utr_number="",
        ),
        status="exception", confidence_score=0.0, signals={},
        discrepancies=[], explanation="No ledger association established.",
        exception_side="bank",
    )
    response = ERPVoucherAgent.generate_vouchers_for_run("R1", [result])
    assert response.vouchers == []
    assert response.manual_review_items[0]["discrepancy_types"] == ["unattributed_bank_credit"]
    assert "<VOUCHER" not in response.tally_batch_xml


def test_empty_voucher_run_does_not_claim_a_balance_check_passed():
    response = ERPVoucherAgent.generate_vouchers_for_run("R1", [])
    assert response.vouchers == []
    assert response.all_balanced is False
