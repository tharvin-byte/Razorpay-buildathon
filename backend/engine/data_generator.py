import json
import random
import uuid
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Any

class SyntheticDataGenerator:
    """
    Generates synthetic multi-source financial datasets conforming to
    Section 3 of the ReconX Technical Design Document.
    
    Generates:
    - Bank Statement (CSV)
    - Internal Ledger (CSV)
    - Network Settlement Report (CSV)
    - Hidden Ground Truth (JSON)
    """
    
    FIRST_NAMES = [
        "Ramesh", "Suresh", "Priya", "Ananya", "Rahul", "Vikram", "Neha",
        "Deepak", "Sneha", "Amit", "Pooja", "Arjun", "Kavita", "Rajesh",
        "Sunita", "Manoj", "Divya", "Sanjay", "Meera", "Aditya", "Swati",
        "Karan", "Rohit", "Tanvi", "Naveen", "Shreya", "Gaurav", "Anita"
    ]
    LAST_NAMES = [
        "Kumar", "Sharma", "Verma", "Patel", "Reddy", "Gupta", "Iyer",
        "Nair", "Mehta", "Singh", "Joshi", "Das", "Rao", "Chopra",
        "Bhat", "Deshmukh", "Pillai", "Agarwal", "Bose", "Menon"
    ]
    
    MERCHANTS = [
        ("merchant_88213", "TechMart India"),
        ("merchant_44109", "QuickCart Retail"),
        ("merchant_19283", "Zenith Electronics"),
        ("merchant_99012", "UrbanFresh Groceries"),
        ("merchant_33219", "Apex Cloud Services")
    ]
    
    PAYMENT_METHODS = ["UPI", "card", "netbanking"]
    
    def __init__(self, seed: int = 42):
        self.seed = seed
        random.seed(seed)
        
    def _generate_utr(self, dt: datetime, idx: int) -> str:
        date_str = dt.strftime("%Y%m%d")
        return f"UTR{date_str}{idx:04d}{random.randint(100, 999)}"

    def _generate_narration(self, rail: str, name: str, inv_ref: str, phone: str, ifsc: str) -> str:
        clean_name = name.replace(" ", "").upper()
        if rail == "UPI":
            return f"UPI/{clean_name}/{phone}/{inv_ref}"
        elif rail == "NEFT":
            return f"NEFT-CR-{ifsc}-{clean_name}-{inv_ref}"
        elif rail == "IMPS":
            return f"IMPS-P2A-{phone[:7]}-{clean_name}-{inv_ref}"
        else:
            return f"RTGS-{ifsc}-{clean_name}-{inv_ref}"

    def generate_batch(self, total_bank_records: int = 70, start_date: str = "2026-03-01") -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, List[Dict[str, Any]]]:
        base_dt = datetime.strptime(start_date, "%Y-%m-%d")
        
        bank_records: List[Dict[str, Any]] = []
        ledger_records: List[Dict[str, Any]] = []
        settlement_records: List[Dict[str, Any]] = []
        ground_truth: List[Dict[str, Any]] = []
        
        # Calculate distribution counts
        # ~70% clean matches (~48 records)
        # ~15% discrepancy matches (~11 records)
        # ~10% missing UTR (~7 records)
        # ~5% bank orphans (~4 records)
        
        clean_count = int(total_bank_records * 0.68)
        discrepancy_count = int(total_bank_records * 0.16)
        missing_utr_count = int(total_bank_records * 0.10)
        bank_orphan_count = max(2, total_bank_records - (clean_count + discrepancy_count + missing_utr_count))
        
        # Batch settlement accounts for 2 multi-ledger pairs
        batch_settlement_count = 2
        
        # Additional Ledger orphans & failed expected non-matches
        ledger_orphan_count = 4
        ledger_failed_count = 3
        
        global_txn_idx = 1000
        ledger_idx = 1000
        
        # -------------------------------------------------------------
        # 1. Clean Matches (~70%)
        # -------------------------------------------------------------
        for i in range(clean_count):
            global_txn_idx += 1
            ledger_idx += 1
            
            day_offset = random.randint(0, 5)
            txn_date = base_dt + timedelta(days=day_offset)
            date_str = txn_date.strftime("%Y-%m-%d")
            
            first = random.choice(self.FIRST_NAMES)
            last = random.choice(self.LAST_NAMES)
            full_name = f"{first} {last}"
            
            merchant_id, _ = random.choice(self.MERCHANTS)
            gross = round(random.uniform(500, 15000), 2)
            fee_pct = 0.015 # 1.5% Razorpay fee
            rzp_fee = round(gross * fee_pct, 2)
            net_amt = round(gross - rzp_fee, 2)
            
            utr = self._generate_utr(txn_date, global_txn_idx)
            order_id = f"order_{uuid.uuid4().hex[:9]}"
            inv_ref = f"INV{global_txn_idx}"
            bank_txn_id = f"BNK-{txn_date.strftime('%Y%m%d')}-{global_txn_idx}"
            ledger_id = f"LEDG-{ledger_idx:06d}"
            settle_id = f"NPCI-SET-{global_txn_idx:05d}"
            
            rail = random.choice(["UPI", "NEFT", "IMPS"])
            phone = f"98{random.randint(10000000, 99999999)}"
            ifsc = f"HDFC000{random.randint(1000, 9999)}"
            narration = self._generate_narration(rail, full_name, inv_ref, phone, ifsc)
            
            # Bank statement record
            bank_records.append({
                "bank_txn_id": bank_txn_id,
                "date": date_str,
                "amount": net_amt,
                "type": "credit",
                "counterparty_account": f"XXXXXX{random.randint(1000, 9999)}",
                "narration": narration,
                "utr_number": utr
            })
            
            # Internal ledger record
            ledger_records.append({
                "ledger_entry_id": ledger_id,
                "order_id": order_id,
                "merchant_id": merchant_id,
                "expected_settlement_date": date_str,
                "gross_amount": gross,
                "razorpay_fee": rzp_fee,
                "refund_amount": 0.00,
                "counterparty_name": full_name,
                "invoice_ref": inv_ref,
                "status": "settled",
                "utr_number": utr
            })
            
            # Network settlement record
            settlement_records.append({
                "network_settlement_id": settle_id,
                "settlement_batch_date": date_str,
                "payment_method": rail,
                "gross_amount": gross,
                "network_fee": round(rzp_fee * 0.6, 2),
                "net_amount": net_amt,
                "merchant_order_ref": inv_ref,
                "utr_number": utr
            })
            
            ground_truth.append({
                "bank_txn_id": bank_txn_id,
                "ledger_entry_ids": [ledger_id],
                "settlement_id": settle_id,
                "expected_status": "matched_clean",
                "expected_discrepancies": [],
                "is_orphan": False,
                "notes": "Standard clean match with matching UTR and expected fee"
            })

        # -------------------------------------------------------------
        # 2. Discrepancy Matches (~15%)
        # -------------------------------------------------------------
        discrepancy_types = [
            "fee_gap", "timing_lag_T1", "timing_lag_T2", "partial_refund",
            "rounding_difference", "reference_case_diff", "duplicate_retry", "batch_settlement"
        ]
        
        for i in range(discrepancy_count):
            global_txn_idx += 1
            ledger_idx += 1
            
            day_offset = random.randint(0, 4)
            txn_date = base_dt + timedelta(days=day_offset)
            date_str = txn_date.strftime("%Y-%m-%d")
            
            first = random.choice(self.FIRST_NAMES)
            last = random.choice(self.LAST_NAMES)
            full_name = f"{first} {last}"
            merchant_id, _ = random.choice(self.MERCHANTS)
            
            disc_type = discrepancy_types[i % len(discrepancy_types)]
            gross = round(random.uniform(1000, 12000), 2)
            rzp_fee = round(gross * 0.02, 2)
            refund_amt = 0.00
            bank_amt = round(gross - rzp_fee, 2)
            
            bank_date = date_str
            ledger_expected_date = date_str
            settle_date = date_str
            
            utr = self._generate_utr(txn_date, global_txn_idx)
            order_id = f"order_{uuid.uuid4().hex[:9]}"
            inv_ref = f"INV{global_txn_idx}"
            bank_txn_id = f"BNK-{txn_date.strftime('%Y%m%d')}-{global_txn_idx}"
            ledger_id = f"LEDG-{ledger_idx:06d}"
            settle_id = f"NPCI-SET-{global_txn_idx:05d}"
            
            expected_discs = []
            
            if disc_type == "fee_gap":
                # Extra non-standard surcharge or fee gap of ₹25
                extra_fee = 25.00
                bank_amt = round(gross - (rzp_fee + extra_fee), 2)
                expected_discs.append("fee_deduction")
                
            elif disc_type == "timing_lag_T1":
                # Bank records on T+1
                bank_dt = txn_date + timedelta(days=1)
                bank_date = bank_dt.strftime("%Y-%m-%d")
                expected_discs.append("timing_lag")
                
            elif disc_type == "timing_lag_T2":
                # Bank records on T+2
                bank_dt = txn_date + timedelta(days=2)
                bank_date = bank_dt.strftime("%Y-%m-%d")
                expected_discs.append("timing_lag")
                
            elif disc_type == "partial_refund":
                # A partial refund was issued
                refund_amt = round(gross * 0.25, 2)
                bank_amt = round(gross - rzp_fee - refund_amt, 2)
                expected_discs.append("partial_refund")
                
            elif disc_type == "rounding_difference":
                # Small 40 paisa gap
                bank_amt = round(bank_amt + 0.40, 2)
                expected_discs.append("rounding_difference")
                
            elif disc_type == "reference_case_diff":
                # Reference formatting difference (e.g. inv-2001 vs INV2001)
                inv_ref = f"inv_{global_txn_idx}"
                expected_discs.append("reference_formatting")
                
            elif disc_type == "duplicate_retry":
                # Duplicate retry recorded in ledger as failed first, settled second
                expected_discs.append("duplicate_retry")
                
            elif disc_type == "batch_settlement":
                # 2 ledger items settling as 1 lump bank credit
                ledger_idx_2 = ledger_idx + 100
                ledger_id_2 = f"LEDG-{ledger_idx_2:06d}"
                gross_2 = 3200.00
                fee_2 = 64.00
                net_2 = 3136.00
                
                # Bank gets combined net amount
                combined_net = round(bank_amt + net_2, 2)
                
                ledger_records.append({
                    "ledger_entry_id": ledger_id_2,
                    "order_id": f"order_{uuid.uuid4().hex[:9]}",
                    "merchant_id": merchant_id,
                    "expected_settlement_date": date_str,
                    "gross_amount": gross_2,
                    "razorpay_fee": fee_2,
                    "refund_amount": 0.00,
                    "counterparty_name": full_name,
                    "invoice_ref": f"INV{global_txn_idx}-B",
                    "status": "settled",
                    "utr_number": utr
                })
                
                bank_records.append({
                    "bank_txn_id": bank_txn_id,
                    "date": bank_date,
                    "amount": combined_net,
                    "type": "credit",
                    "counterparty_account": f"XXXXXX{random.randint(1000, 9999)}",
                    "narration": f"BULK-SETTLEMENT-{merchant_id}-{inv_ref}",
                    "utr_number": utr
                })
                
                ledger_records.append({
                    "ledger_entry_id": ledger_id,
                    "order_id": order_id,
                    "merchant_id": merchant_id,
                    "expected_settlement_date": ledger_expected_date,
                    "gross_amount": gross,
                    "razorpay_fee": rzp_fee,
                    "refund_amount": refund_amt,
                    "counterparty_name": full_name,
                    "invoice_ref": inv_ref,
                    "status": "settled",
                    "utr_number": utr
                })
                
                ground_truth.append({
                    "bank_txn_id": bank_txn_id,
                    "ledger_entry_ids": [ledger_id, ledger_id_2],
                    "settlement_id": settle_id,
                    "expected_status": "matched_with_discrepancy",
                    "expected_discrepancies": ["batch_settlement"],
                    "is_orphan": False,
                    "notes": f"Batch settlement of 2 ledger entries into 1 lump bank credit (₹{combined_net})"
                })
                continue

            rail = random.choice(["UPI", "NEFT", "IMPS"])
            phone = f"98{random.randint(10000000, 99999999)}"
            ifsc = f"ICIC000{random.randint(1000, 9999)}"
            narration = self._generate_narration(rail, full_name, inv_ref, phone, ifsc)
            
            bank_records.append({
                "bank_txn_id": bank_txn_id,
                "date": bank_date,
                "amount": bank_amt,
                "type": "credit",
                "counterparty_account": f"XXXXXX{random.randint(1000, 9999)}",
                "narration": narration,
                "utr_number": utr
            })
            
            ledger_records.append({
                "ledger_entry_id": ledger_id,
                "order_id": order_id,
                "merchant_id": merchant_id,
                "expected_settlement_date": ledger_expected_date,
                "gross_amount": gross,
                "razorpay_fee": rzp_fee,
                "refund_amount": refund_amt,
                "counterparty_name": full_name,
                "invoice_ref": inv_ref,
                "status": "settled",
                "utr_number": utr
            })
            
            settlement_records.append({
                "network_settlement_id": settle_id,
                "settlement_batch_date": settle_date,
                "payment_method": rail,
                "gross_amount": gross,
                "network_fee": round(rzp_fee * 0.5, 2),
                "net_amount": bank_amt,
                "merchant_order_ref": inv_ref,
                "utr_number": utr
            })
            
            ground_truth.append({
                "bank_txn_id": bank_txn_id,
                "ledger_entry_ids": [ledger_id],
                "settlement_id": settle_id,
                "expected_status": "matched_with_discrepancy",
                "expected_discrepancies": expected_discs,
                "is_orphan": False,
                "notes": f"Discrepancy test case: {', '.join(expected_discs)}"
            })

        # -------------------------------------------------------------
        # 3. Missing UTR Matches (~10%) - Requires Narration Parsing / LLM
        # -------------------------------------------------------------
        for i in range(missing_utr_count):
            global_txn_idx += 1
            ledger_idx += 1
            
            day_offset = random.randint(0, 3)
            txn_date = base_dt + timedelta(days=day_offset)
            date_str = txn_date.strftime("%Y-%m-%d")
            
            first = random.choice(self.FIRST_NAMES)
            last = random.choice(self.LAST_NAMES)
            full_name = f"{first} {last}"
            merchant_id, _ = random.choice(self.MERCHANTS)
            
            gross = round(random.uniform(800, 8500), 2)
            rzp_fee = round(gross * 0.018, 2)
            net_amt = round(gross - rzp_fee, 2)
            
            order_id = f"order_{uuid.uuid4().hex[:9]}"
            inv_ref = f"INV{global_txn_idx}"
            bank_txn_id = f"BNK-{txn_date.strftime('%Y%m%d')}-{global_txn_idx}"
            ledger_id = f"LEDG-{ledger_idx:06d}"
            settle_id = f"NPCI-SET-{global_txn_idx:05d}"
            
            # Bank statement has NO UTR
            # Narration styles:
            # 50% clean regex template, 50% messy / truncated requiring LLM
            if i % 2 == 0:
                rail = "UPI"
                narration = f"UPI/{full_name.replace(' ', '').upper()}/9988776655/{inv_ref}"
            else:
                rail = "NEFT"
                # Atypical/messy format: e.g. "TRF FRM RAMESH KUMAR FOR INV#INV1055 VIA NEFT"
                narration = f"TRF FRM {full_name.upper()} FOR BILL {inv_ref} VIA CORP NETBANKING"
            
            bank_records.append({
                "bank_txn_id": bank_txn_id,
                "date": date_str,
                "amount": net_amt,
                "type": "credit",
                "counterparty_account": f"XXXXXX{random.randint(1000, 9999)}",
                "narration": narration,
                "utr_number": "" # Deliberately empty UTR
            })
            
            ledger_records.append({
                "ledger_entry_id": ledger_id,
                "order_id": order_id,
                "merchant_id": merchant_id,
                "expected_settlement_date": date_str,
                "gross_amount": gross,
                "razorpay_fee": rzp_fee,
                "refund_amount": 0.00,
                "counterparty_name": full_name,
                "invoice_ref": inv_ref,
                "status": "settled",
                "utr_number": "" # Deliberately missing on ledger as well
            })
            
            ground_truth.append({
                "bank_txn_id": bank_txn_id,
                "ledger_entry_ids": [ledger_id],
                "settlement_id": settle_id,
                "expected_status": "matched_clean",
                "expected_discrepancies": ["missing_utr_resolved_via_narration"],
                "is_orphan": False,
                "notes": "Missing UTR resolved via narration parsing (regex or LLM) + fuzzy name/amount match"
            })

        # -------------------------------------------------------------
        # 4. Bank-Side Orphans (~5%) - Money received but no ledger entry
        # -------------------------------------------------------------
        for i in range(bank_orphan_count):
            global_txn_idx += 1
            day_offset = random.randint(0, 4)
            txn_date = base_dt + timedelta(days=day_offset)
            date_str = txn_date.strftime("%Y-%m-%d")
            
            bank_txn_id = f"BNK-{txn_date.strftime('%Y%m%d')}-{global_txn_idx}"
            orphan_amount = round(random.uniform(1200, 9000), 2)
            orphan_utr = self._generate_utr(txn_date, global_txn_idx)
            
            # Unknown direct credit or mystery deposit
            narration = f"DIRECT-DEP-UNKNOWN-REMITTER-{random.randint(100000, 999999)}"
            
            bank_records.append({
                "bank_txn_id": bank_txn_id,
                "date": date_str,
                "amount": orphan_amount,
                "type": "credit",
                "counterparty_account": f"XXXXXX{random.randint(1000, 9999)}",
                "narration": narration,
                "utr_number": orphan_utr
            })
            
            ground_truth.append({
                "bank_txn_id": bank_txn_id,
                "ledger_entry_ids": [],
                "settlement_id": None,
                "expected_status": "exception",
                "expected_discrepancies": ["unreconciled_orphan"],
                "is_orphan": True,
                "orphan_side": "bank",
                "notes": "Bank credit with no corresponding ledger entry (true bank orphan)"
            })

        # -------------------------------------------------------------
        # 5. Ledger-Side Orphans (Money expected but never received)
        # -------------------------------------------------------------
        for i in range(ledger_orphan_count):
            ledger_idx += 1
            day_offset = random.randint(0, 3)
            txn_date = base_dt + timedelta(days=day_offset)
            date_str = txn_date.strftime("%Y-%m-%d")
            
            first = random.choice(self.FIRST_NAMES)
            last = random.choice(self.LAST_NAMES)
            full_name = f"{first} {last}"
            merchant_id, _ = random.choice(self.MERCHANTS)
            
            gross = round(random.uniform(2000, 15000), 2)
            rzp_fee = round(gross * 0.02, 2)
            ledger_id = f"LEDG-{ledger_idx:06d}"
            order_id = f"order_{uuid.uuid4().hex[:9]}"
            inv_ref = f"INV{ledger_idx}"
            
            ledger_records.append({
                "ledger_entry_id": ledger_id,
                "order_id": order_id,
                "merchant_id": merchant_id,
                "expected_settlement_date": date_str,
                "gross_amount": gross,
                "razorpay_fee": rzp_fee,
                "refund_amount": 0.00,
                "counterparty_name": full_name,
                "invoice_ref": inv_ref,
                "status": "pending", # Or settled in ledger, but never reached bank
                "utr_number": f"UTR-UNSETTLED-{ledger_idx}"
            })
            
            ground_truth.append({
                "bank_txn_id": None,
                "ledger_entry_ids": [ledger_id],
                "settlement_id": None,
                "expected_status": "exception",
                "expected_discrepancies": ["unreconciled_orphan"],
                "is_orphan": True,
                "orphan_side": "ledger",
                "notes": "Ledger entry marked pending/settled but never received in bank (true ledger orphan)"
            })

        # -------------------------------------------------------------
        # 6. Expected Non-Matches (Ledger status = failed)
        # -------------------------------------------------------------
        for i in range(ledger_failed_count):
            ledger_idx += 1
            day_offset = random.randint(0, 3)
            txn_date = base_dt + timedelta(days=day_offset)
            date_str = txn_date.strftime("%Y-%m-%d")
            
            first = random.choice(self.FIRST_NAMES)
            last = random.choice(self.LAST_NAMES)
            full_name = f"{first} {last}"
            merchant_id, _ = random.choice(self.MERCHANTS)
            
            gross = round(random.uniform(1000, 5000), 2)
            rzp_fee = round(gross * 0.02, 2)
            ledger_id = f"LEDG-{ledger_idx:06d}"
            order_id = f"order_{uuid.uuid4().hex[:9]}"
            inv_ref = f"INV{ledger_idx}"
            
            ledger_records.append({
                "ledger_entry_id": ledger_id,
                "order_id": order_id,
                "merchant_id": merchant_id,
                "expected_settlement_date": date_str,
                "gross_amount": gross,
                "razorpay_fee": rzp_fee,
                "refund_amount": 0.00,
                "counterparty_name": full_name,
                "invoice_ref": inv_ref,
                "status": "failed", # Transaction failed, correctly no bank credit
                "utr_number": ""
            })
            
            ground_truth.append({
                "bank_txn_id": None,
                "ledger_entry_ids": [ledger_id],
                "settlement_id": None,
                "expected_status": "expected_non_match",
                "expected_discrepancies": ["status_failed"],
                "is_orphan": False,
                "orphan_side": None,
                "notes": "Transaction failed at payment gateway - correctly expected not to settle"
            })

        # Shuffle lists to prevent positional bias
        random.shuffle(bank_records)
        random.shuffle(ledger_records)
        random.shuffle(settlement_records)
        
        df_bank = pd.DataFrame(bank_records)
        df_ledger = pd.DataFrame(ledger_records)
        df_settlement = pd.DataFrame(settlement_records)
        
        return df_bank, df_ledger, df_settlement, ground_truth

    def save_dataset(self, output_dir: str = "data") -> Dict[str, str]:
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        df_bank, df_ledger, df_settle, ground_truth = self.generate_batch(total_bank_records=70)
        
        bank_path = os.path.join(output_dir, "bank_statement.csv")
        ledger_path = os.path.join(output_dir, "internal_ledger.csv")
        settle_path = os.path.join(output_dir, "settlement_report.csv")
        gt_path = os.path.join(output_dir, "ground_truth.json")
        
        df_bank.to_csv(bank_path, index=False)
        df_ledger.to_csv(ledger_path, index=False)
        df_settle.to_csv(settle_path, index=False)
        
        with open(gt_path, "w") as f:
            json.dump(ground_truth, f, indent=2)
            
        return {
            "bank_statement": bank_path,
            "internal_ledger": ledger_path,
            "settlement_report": settle_path,
            "ground_truth": gt_path,
            "bank_count": len(df_bank),
            "ledger_count": len(df_ledger),
            "settlement_count": len(df_settle),
            "ground_truth_count": len(ground_truth)
        }

if __name__ == "__main__":
    generator = SyntheticDataGenerator(seed=42)
    stats = generator.save_dataset("data")
    print(f"Generated synthetic batch: {stats}")
