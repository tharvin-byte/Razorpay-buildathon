import sys
import os

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

from backend.engine.agents.discrepancy_agent import DiscrepancyDecompositionAgent
from backend.models.schemas import DiscrepancyDetail

def run_comprehensive_xai_test_suite():
    print("=" * 80)
    print("🔬 RECONX COMPREHENSIVE XAI & AUDIT STORY VALIDATION TEST SUITE")
    print("=" * 80)
    
    test_cases = [
        {
            "id": "TC-01",
            "name": "Standard Clean Commercial Settlement",
            "bank": {"bank_txn_id": "BNK-20260301-1001", "amount": 4900.00, "date": "2026-03-01", "utr_number": "UTR202603011001001"},
            "ledger": {"ledger_entry_id": "LEDG-001001", "gross_amount": 5000.00, "razorpay_fee": 100.00, "refund_amount": 0.0, "counterparty_name": "Rohan Sharma", "invoice_ref": "INV1001", "expected_settlement_date": "2026-03-01"},
            "confidence": 0.99
        },
        {
            "id": "TC-02",
            "name": "Clearinghouse Timing Lag (T+1 Cycle)",
            "bank": {"bank_txn_id": "BNK-20260302-1002", "amount": 4900.00, "date": "2026-03-02", "utr_number": "UTR202603011002002"},
            "ledger": {"ledger_entry_id": "LEDG-001002", "gross_amount": 5000.00, "razorpay_fee": 100.00, "refund_amount": 0.0, "counterparty_name": "Priya Patel", "invoice_ref": "INV1002", "expected_settlement_date": "2026-03-01"},
            "confidence": 0.985
        },
        {
            "id": "TC-03",
            "name": "Consolidated Batch Settlement (N:1 Payout)",
            "bank": {"bank_txn_id": "BNK-20260303-1003", "amount": 8900.00, "date": "2026-03-03", "utr_number": "UTR202603031003003"},
            "ledger": {"ledger_entry_id": "LEDG-001003", "gross_amount": 5000.00, "razorpay_fee": 100.00, "refund_amount": 0.0, "counterparty_name": "Karan Deshmukh", "invoice_ref": "INV1003", "expected_settlement_date": "2026-03-03"},
            "confidence": 0.98
        },
        {
            "id": "TC-04",
            "name": "Customer Partial Refund Clawback",
            "bank": {"bank_txn_id": "BNK-20260304-1004", "amount": 4400.00, "date": "2026-03-04", "utr_number": "UTR202603041004004"},
            "ledger": {"ledger_entry_id": "LEDG-001004", "gross_amount": 5000.00, "razorpay_fee": 100.00, "refund_amount": 500.00, "counterparty_name": "Sneha Reddy", "invoice_ref": "INV1004", "expected_settlement_date": "2026-03-04"},
            "confidence": 0.985
        },
        {
            "id": "TC-05",
            "name": "Fractional Paisa Rounding Variance (GST Fee)",
            "bank": {"bank_txn_id": "BNK-20260305-1005", "amount": 4900.40, "date": "2026-03-05", "utr_number": "UTR202603051005005"},
            "ledger": {"ledger_entry_id": "LEDG-001005", "gross_amount": 5000.00, "razorpay_fee": 100.00, "refund_amount": 0.0, "counterparty_name": "Neha Chopra", "invoice_ref": "INV1005", "expected_settlement_date": "2026-03-05"},
            "confidence": 0.99
        },
        {
            "id": "TC-06",
            "name": "Abnormal Unexplained Gateway Fee Deduction",
            "bank": {"bank_txn_id": "BNK-20260306-1006", "amount": 4650.00, "date": "2026-03-06", "utr_number": "UTR202603061006006"},
            "ledger": {"ledger_entry_id": "LEDG-001006", "gross_amount": 5000.00, "razorpay_fee": 100.00, "refund_amount": 0.0, "counterparty_name": "Manoj Gupta", "invoice_ref": "INV1006", "expected_settlement_date": "2026-03-06"},
            "confidence": 0.97
        }
    ]
    
    for tc in test_cases:
        print(f"\n▶ [{tc['id']}] {tc['name'].upper()}")
        print("-" * 60)
        
        # Analyze discrepancies
        discs = DiscrepancyDecompositionAgent.analyze_matched_pair(tc["bank"], tc["ledger"])
        
        # Compose narrative story
        story = DiscrepancyDecompositionAgent.compose_explanation(tc["bank"], tc["ledger"], tc["confidence"], discs)
        
        # Print results
        print(f"📊 Discrepancies Flagged : {[d.type for d in discs] if discs else 'None (Clean Match)'}")
        print(f"📜 Generated Story:\n{story}")
        print("-" * 60)
        
    print("\n" + "=" * 80)
    print("🛡️ EXCEPTION & ZERO-GUESSING QUARANTINE VALIDATION")
    print("=" * 80)
    
    exception_cases = [
        {
            "id": "EX-01",
            "name": "Bank Orphan (Unidentified Credit)",
            "bank": {"bank_txn_id": "BNK-20260307-9999", "amount": 12500.00, "utr_number": "UTR202603079999999"},
            "candidate": None
        },
        {
            "id": "EX-02",
            "name": "Ambiguous Candidate Match (52% Confidence)",
            "bank": {"bank_txn_id": "BNK-20260308-8888", "amount": 3200.00, "utr_number": "UTR202603088888888"},
            "candidate": {"score": 0.52, "ledger_record": {"ledger_entry_id": "LEDG-008888", "counterparty_name": "Vikram Malhotra"}, "is_claimed": False}
        },
        {
            "id": "EX-03",
            "name": "Duplicate Claim Conflict Prevention",
            "bank": {"bank_txn_id": "BNK-20260309-7777", "amount": 5000.00, "utr_number": "UTR202603097777777"},
            "candidate": {"score": 0.98, "ledger_record": {"ledger_entry_id": "LEDG-007777", "counterparty_name": "Ananya Iyer"}, "is_claimed": True, "claimed_by": "BNK-20260301-1001"}
        }
    ]
    
    for ex in exception_cases:
        print(f"\n▶ [{ex['id']}] {ex['name'].upper()}")
        print("-" * 60)
        exc_reason = DiscrepancyDecompositionAgent.compose_exception_reason(ex["bank"], ex["candidate"])
        print(f"📜 Quarantined Reason:\n{exc_reason}")
        print("-" * 60)

if __name__ == "__main__":
    run_comprehensive_xai_test_suite()
