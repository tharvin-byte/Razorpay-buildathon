import sys
import os
import pandas as pd

# Ensure UTF-8 console output
sys.stdout.reconfigure(encoding='utf-8')

from backend.engine.orchestrator import ReconciliationOrchestrator
from backend.models.schemas import ReconciliationResult

def test_realtime_conflict_cases():
    print("=" * 85)
    print("🏦 RECONX REAL-TIME FINANCIAL CONFLICT & DISCREPANCY BENCHMARK")
    print("=" * 85)
    
    # -------------------------------------------------------------------------
    # 1. Construct Realistic Multi-Source Datasets with Diverse Conflicts
    # -------------------------------------------------------------------------
    
    bank_records = [
        # Conflict 1: Batch Settlement Bundle (Bank deposit combines 2 orders)
        {
            "bank_txn_id": "BNK-BATCH-001",
            "date": "2026-03-03",
            "amount": 6860.00,
            "type": "credit",
            "counterparty_account": "ACC_HDFC_01",
            "narration": "UPI/CONSOLIDATED_PAYOUT/TECHMART/INV801_INV802",
            "utr_number": "UTR20260303BATCH801"
        },
        # Conflict 2: Customer Partial Refund Clawback
        {
            "bank_txn_id": "BNK-REFUND-002",
            "date": "2026-03-03",
            "amount": 6830.00,
            "type": "credit",
            "counterparty_account": "ACC_HDFC_02",
            "narration": "UPI/SNEHA_REDDY/INV803/PARTIAL_RET",
            "utr_number": "UTR20260303REF803"
        },
        # Conflict 3: Weekend Settlement Lag (T+2 Clearinghouse Cycle)
        {
            "bank_txn_id": "BNK-LAG-003",
            "date": "2026-03-05",  # Settled Mar 5 (Ledger was Mar 3)
            "amount": 4900.00,
            "type": "credit",
            "counterparty_account": "ACC_HDFC_03",
            "narration": "NEFT/PRIYAPATEL/INV804/CLEARING_CYCLE",
            "utr_number": "UTR20260305LAG804"
        },
        # Conflict 4: Abnormal Unauthorized Gateway Fee Gap (Gateway took 6% instead of 2%)
        {
            "bank_txn_id": "BNK-OVERFEE-004",
            "date": "2026-03-03",
            "amount": 9400.00,  # Expected 9,800.00, missing 400.00
            "type": "credit",
            "counterparty_account": "ACC_HDFC_04",
            "narration": "UPI/MANOJ_GUPTA/INV805/RZP_SETTLE",
            "utr_number": "UTR20260303FEE805"
        },
        # Conflict 5: Paisa Rounding Variance on GST Fee Computation
        {
            "bank_txn_id": "BNK-ROUND-005",
            "date": "2026-03-03",
            "amount": 2451.40,  # ₹0.40 rounding difference
            "type": "credit",
            "counterparty_account": "ACC_HDFC_05",
            "narration": "UPI/NEHA_CHOPRA/INV806/GST_ROUND",
            "utr_number": "UTR20260303RND806"
        },
        # Conflict 6: Duplicate Bank Deposit / Double Claim Conflict
        {
            "bank_txn_id": "BNK-DUP-006A",
            "date": "2026-03-03",
            "amount": 3920.00,
            "type": "credit",
            "counterparty_account": "ACC_HDFC_06",
            "narration": "UPI/ROHIT_SHARMA/INV807/FIRST_TXN",
            "utr_number": "UTR20260303DUP807"
        },
        {
            "bank_txn_id": "BNK-DUP-006B",  # Duplicate second payment attempting to claim same invoice
            "date": "2026-03-03",
            "amount": 3920.00,
            "type": "credit",
            "counterparty_account": "ACC_HDFC_06",
            "narration": "UPI/ROHIT_SHARMA/INV807/DUPLICATE_RETRY",
            "utr_number": "UTR20260303DUP807"
        },
        # Conflict 7: Bank Orphan (Unidentified Credit)
        {
            "bank_txn_id": "BNK-ORPHAN-007",
            "date": "2026-03-03",
            "amount": 55000.00,
            "type": "credit",
            "counterparty_account": "ACC_UNKNOWN_99",
            "narration": "NEFT/UNREGISTERED_CORP_PAYMENT/UNKNOWN_REF",
            "utr_number": "UTR20260303ORP999"
        }
    ]
    
    ledger_records = [
        # Match for Conflict 1
        {
            "ledger_entry_id": "LEDG-000801",
            "order_id": "ORD-801",
            "merchant_id": "MERCH-01",
            "expected_settlement_date": "2026-03-03",
            "gross_amount": 3000.00,
            "razorpay_fee": 60.00,
            "refund_amount": 0.0,
            "counterparty_name": "TechMart Retail",
            "invoice_ref": "INV801",
            "status": "settled",
            "utr_number": "UTR20260303BATCH801"
        },
        # Match for Conflict 2
        {
            "ledger_entry_id": "LEDG-000803",
            "order_id": "ORD-803",
            "merchant_id": "MERCH-01",
            "expected_settlement_date": "2026-03-03",
            "gross_amount": 8500.00,
            "razorpay_fee": 170.00,
            "refund_amount": 1500.00,
            "counterparty_name": "Sneha Reddy",
            "invoice_ref": "INV803",
            "status": "settled",
            "utr_number": "UTR20260303REF803"
        },
        # Match for Conflict 3
        {
            "ledger_entry_id": "LEDG-000804",
            "order_id": "ORD-804",
            "merchant_id": "MERCH-01",
            "expected_settlement_date": "2026-03-03",  # Expected Mar 3
            "gross_amount": 5000.00,
            "razorpay_fee": 100.00,
            "refund_amount": 0.0,
            "counterparty_name": "Priya Patel",
            "invoice_ref": "INV804",
            "status": "settled",
            "utr_number": "UTR20260305LAG804"
        },
        # Match for Conflict 4
        {
            "ledger_entry_id": "LEDG-000805",
            "order_id": "ORD-805",
            "merchant_id": "MERCH-01",
            "expected_settlement_date": "2026-03-03",
            "gross_amount": 10000.00,
            "razorpay_fee": 200.00,
            "refund_amount": 0.0,
            "counterparty_name": "Manoj Gupta",
            "invoice_ref": "INV805",
            "status": "settled",
            "utr_number": "UTR20260303FEE805"
        },
        # Match for Conflict 5
        {
            "ledger_entry_id": "LEDG-000806",
            "order_id": "ORD-806",
            "merchant_id": "MERCH-01",
            "expected_settlement_date": "2026-03-03",
            "gross_amount": 2500.00,
            "razorpay_fee": 49.00,
            "refund_amount": 0.0,
            "counterparty_name": "Neha Chopra",
            "invoice_ref": "INV806",
            "status": "settled",
            "utr_number": "UTR20260303RND806"
        },
        # Match for Conflict 6
        {
            "ledger_entry_id": "LEDG-000807",
            "order_id": "ORD-807",
            "merchant_id": "MERCH-01",
            "expected_settlement_date": "2026-03-03",
            "gross_amount": 4000.00,
            "razorpay_fee": 80.00,
            "refund_amount": 0.0,
            "counterparty_name": "Rohit Sharma",
            "invoice_ref": "INV807",
            "status": "settled",
            "utr_number": "UTR20260303DUP807"
        },
        # Conflict 8: Ledger Orphan (Unsettled Sales Order / Unpaid Customer)
        {
            "ledger_entry_id": "LEDG-ORPHAN-008",
            "order_id": "ORD-808",
            "merchant_id": "MERCH-01",
            "expected_settlement_date": "2026-03-03",
            "gross_amount": 18500.00,
            "razorpay_fee": 370.00,
            "refund_amount": 0.0,
            "counterparty_name": "Apex Cloud Enterprise",
            "invoice_ref": "INV808",
            "status": "pending",
            "utr_number": "UTR_UNSETTLED_808"
        }
    ]
    
    df_bank = pd.DataFrame(bank_records)
    df_ledger = pd.DataFrame(ledger_records)
    
    # -------------------------------------------------------------------------
    # 2. Run Complete Autonomous Pipeline
    # -------------------------------------------------------------------------
    orchestrator = ReconciliationOrchestrator(df_bank, df_ledger)
    results = orchestrator.run_pipeline()
    
    print(f"\n✅ Total Records Processed: {len(results)}\n")
    
    # -------------------------------------------------------------------------
    # 3. Verify Every Real-Time Conflict Result
    # -------------------------------------------------------------------------
    for r in results:
        b_id = r.record_id
        status_tag = f"[{r.status.upper()}]"
        
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"📌 Record ID: {b_id} | Status: {status_tag} | Confidence: {r.confidence_score*100:.1f}%")
        
        if r.discrepancies:
            disc_types = [d.type for d in r.discrepancies]
            print(f"🔍 Discrepancies Identified: {disc_types}")
            for d in r.discrepancies:
                print(f"   • {d.type.upper()}: {d.description}")
        else:
            print("🔍 Discrepancies Identified: None (Clean Balance)")
            
        print(f"\n📜 Generated Auditor Story:\n{r.explanation}")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

if __name__ == "__main__":
    test_realtime_conflict_cases()
