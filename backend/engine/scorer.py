import re
from datetime import datetime
from typing import Dict, Any, Tuple
from rapidfuzz import fuzz

class ScoringTool:
    """
    Deterministic scoring tool that computes multi-signal confidence scores
    between a bank record and candidate ledger/settlement records.
    
    Formula per Section 4.3 of Technical Design Document:
    - UTR match: 0.45
    - Invoice / Order Ref match: 0.25
    - Counterparty Name similarity: 0.15
    - Amount match (fee/refund tolerant): 0.10
    - Date proximity (within settlement window): 0.05
    """
    
    WEIGHT_UTR = 0.45
    WEIGHT_REF = 0.25
    WEIGHT_NAME = 0.15
    WEIGHT_AMOUNT = 0.10
    WEIGHT_DATE = 0.05
    
    DEFAULT_CONFIDENCE_THRESHOLD = 0.75
    ROUNDING_TOLERANCE = 1.00 # ₹1.00
    SETTLEMENT_WINDOW_DAYS = 3
    
    @staticmethod
    def normalize_text(text: str) -> str:
        if not text:
            return ""
        # Remove special characters, extra spaces, uppercase
        clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', str(text)).strip().upper()
        return " ".join(clean.split())

    @classmethod
    def calculate_utr_signal(cls, bank_utr: str, candidate_utr: str) -> Tuple[float, str]:
        bank_utr_clean = (bank_utr or "").strip().upper()
        cand_utr_clean = (candidate_utr or "").strip().upper()
        
        if not bank_utr_clean or not cand_utr_clean:
            return 0.0, "Missing UTR on one or both sides"
            
        if bank_utr_clean == cand_utr_clean:
            return 1.0, f"Exact UTR match: {bank_utr_clean}"
            
        return 0.0, f"UTR mismatch: {bank_utr_clean} vs {cand_utr_clean}"

    @classmethod
    def calculate_ref_signal(cls, narration: str, bank_ref: str, invoice_ref: str, order_id: str) -> Tuple[float, str]:
        narration_upper = (narration or "").upper()
        bank_ref_upper = (bank_ref or "").upper()
        inv_clean = (invoice_ref or "").strip().upper()
        order_clean = (order_id or "").strip().upper()
        
        if not inv_clean and not order_clean:
            return 0.0, "No invoice_ref or order_id available on ledger"
            
        # Exact substring in narration or bank_ref
        if inv_clean and (inv_clean in narration_upper or inv_clean in bank_ref_upper):
            return 1.0, f"Invoice ref '{inv_clean}' found in bank narration/ref"
            
        if order_clean and (order_clean in narration_upper or order_clean in bank_ref_upper):
            return 1.0, f"Order ID '{order_clean}' found in bank narration/ref"
            
        # Fuzzy match against alphanumeric tokens in narration
        tokens = re.findall(r'[A-Z0-9]{4,}', narration_upper)
        max_sim = 0.0
        best_token = ""
        for token in tokens:
            if inv_clean:
                sim = fuzz.ratio(token, inv_clean) / 100.0
                if sim > max_sim:
                    max_sim = sim
                    best_token = token
            if order_clean:
                sim = fuzz.ratio(token, order_clean) / 100.0
                if sim > max_sim:
                    max_sim = sim
                    best_token = token
                    
        if max_sim >= 0.85:
            return max_sim, f"Fuzzy reference match '{best_token}' ~ '{inv_clean or order_clean}' ({max_sim:.2f})"
            
        return 0.0, "No reference or order ID match"

    @classmethod
    def calculate_name_signal(cls, bank_narration: str, extracted_name: str, ledger_name: str) -> Tuple[float, str]:
        clean_ledger = cls.normalize_text(ledger_name)
        if not clean_ledger:
            return 0.0, "Missing counterparty name on ledger"
            
        candidates_to_test = []
        if extracted_name:
            candidates_to_test.append(cls.normalize_text(extracted_name))
        if bank_narration:
            candidates_to_test.append(cls.normalize_text(bank_narration))
            
        if not candidates_to_test:
            return 0.0, "No name information in bank record"
            
        best_ratio = 0.0
        for candidate in candidates_to_test:
            # Token set ratio handles order and partial tokens well ("RAMESH KUMAR" vs "KUMAR RAMESH" or "UPI-RAMESHKUMAR")
            ts_ratio = fuzz.token_set_ratio(candidate, clean_ledger) / 100.0
            part_ratio = fuzz.partial_ratio(candidate, clean_ledger) / 100.0
            ratio = max(ts_ratio, part_ratio)
            if ratio > best_ratio:
                best_ratio = ratio
                
        return best_ratio, f"Name similarity: {best_ratio:.2f} ('{clean_ledger}')"

    @classmethod
    def calculate_amount_signal(cls, bank_amount: float, gross_amount: float, fee: float, refund: float) -> Tuple[float, str]:
        expected_net = round(gross_amount - fee - refund, 2)
        diff_net = abs(round(bank_amount - expected_net, 2))
        diff_gross = abs(round(bank_amount - gross_amount, 2))
        
        # Perfect net match (within ₹1 rounding tolerance)
        if diff_net <= cls.ROUNDING_TOLERANCE:
            return 1.0, f"Exact net amount match (₹{bank_amount:.2f} == expected ₹{expected_net:.2f})"
            
        # Gross match without fee deducted at bank
        if diff_gross <= cls.ROUNDING_TOLERANCE:
            return 0.85, f"Gross amount match (₹{bank_amount:.2f} == gross ₹{gross_amount:.2f}, fee not deducted at bank)"
            
        # Small discrepancy within standard fee range (up to 3.5% of gross or ₹50)
        max_fee_allowance = max(50.0, gross_amount * 0.035)
        if diff_net <= max_fee_allowance:
            score = max(0.5, 1.0 - (diff_net / max_fee_allowance) * 0.5)
            return score, f"Amount close within fee margin (gap: ₹{diff_net:.2f})"
            
        return 0.0, f"Significant amount mismatch: bank ₹{bank_amount:.2f} vs expected net ₹{expected_net:.2f}"

    @classmethod
    def calculate_date_signal(cls, bank_date_str: str, ledger_date_str: str) -> Tuple[float, str]:
        try:
            d_bank = datetime.strptime(bank_date_str.strip()[:10], "%Y-%m-%d")
            d_ledger = datetime.strptime(ledger_date_str.strip()[:10], "%Y-%m-%d")
            days_diff = abs((d_bank - d_ledger).days)
            
            if days_diff == 0:
                return 1.0, "Same day settlement (T+0)"
            elif days_diff == 1:
                return 0.85, "T+1 settlement lag (1 day)"
            elif days_diff == 2:
                return 0.70, "T+2 settlement lag (2 days)"
            elif days_diff <= cls.SETTLEMENT_WINDOW_DAYS:
                return 0.50, f"T+{days_diff} settlement lag (within window)"
            else:
                return 0.0, f"Date out of window ({days_diff} days difference)"
        except Exception as e:
            return 0.0, f"Date parse error: {str(e)}"

    @classmethod
    def score_pair(
        cls,
        bank_record: Dict[str, Any],
        ledger_record: Dict[str, Any],
        extracted_name: str = "",
        extracted_ref: str = ""
    ) -> Dict[str, Any]:
        """
        Computes composite multi-signal weighted score and full signal breakdown.
        """
        bank_utr = bank_record.get("utr_number", "")
        ledger_utr = ledger_record.get("utr_number", "")
        
        narration = bank_record.get("narration", "")
        invoice_ref = ledger_record.get("invoice_ref", "")
        order_id = ledger_record.get("order_id", "")
        ledger_name = ledger_record.get("counterparty_name", "")
        
        bank_amt = float(bank_record.get("amount", 0.0))
        gross_amt = float(ledger_record.get("gross_amount", 0.0))
        fee = float(ledger_record.get("razorpay_fee", 0.0))
        refund = float(ledger_record.get("refund_amount", 0.0))
        
        bank_date = str(bank_record.get("date", ""))
        ledger_date = str(ledger_record.get("expected_settlement_date", ""))
        
        # 1. Signals
        s_utr, utr_desc = cls.calculate_utr_signal(bank_utr, ledger_utr)
        
        # Check extracted ref if available
        comb_ref = extracted_ref or ""
        s_ref, ref_desc = cls.calculate_ref_signal(narration, comb_ref, invoice_ref, order_id)
        
        s_name, name_desc = cls.calculate_name_signal(narration, extracted_name, ledger_name)
        s_amt, amt_desc = cls.calculate_amount_signal(bank_amt, gross_amt, fee, refund)
        s_date, date_desc = cls.calculate_date_signal(bank_date, ledger_date)
        
        # 2. Weighted Total
        total = (
            s_utr * cls.WEIGHT_UTR +
            s_ref * cls.WEIGHT_REF +
            s_name * cls.WEIGHT_NAME +
            s_amt * cls.WEIGHT_AMOUNT +
            s_date * cls.WEIGHT_DATE
        )
        
        # Normalize / round to 4 decimals
        total_score = round(min(1.0, max(0.0, total)), 4)
        
        return {
            "total_score": total_score,
            "signals": {
                "utr_match": round(s_utr, 4),
                "invoice_ref_match": round(s_ref, 4),
                "counterparty_name_sim": round(s_name, 4),
                "amount_match": round(s_amt, 4),
                "date_proximity": round(s_date, 4),
                "total_score": total_score,
                "details": {
                    "utr": utr_desc,
                    "reference": ref_desc,
                    "name": name_desc,
                    "amount": amt_desc,
                    "date": date_desc
                }
            }
        }
