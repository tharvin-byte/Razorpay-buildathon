import math
import re
from datetime import datetime
from typing import Dict, Any, Tuple
from rapidfuzz import fuzz

def clean_str(val: Any) -> str:
    """Safely converts any value (including NaN, None, or float) to a clean string."""
    if val is None:
        return ""
    if isinstance(val, float) and (math.isnan(val) or val != val):
        return ""
    s = str(val).strip()
    return "" if s.lower() in ("nan", "none", "null") else s

def clean_float(val: Any, default: float = 0.0) -> float:
    """Safely converts any value to a float, defaulting to 0.0 for NaNs or invalid strings."""
    if val is None:
        return default
    if isinstance(val, float):
        return default if (math.isnan(val) or val != val) else val
    try:
        s = str(val).strip()
        if not s or s.lower() in ("nan", "none", "null"):
            return default
        return float(s)
    except (ValueError, TypeError):
        return default

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
    def normalize_text(text: Any) -> str:
        s = clean_str(text)
        if not s:
            return ""
        # Remove special characters, extra spaces, uppercase
        clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', s).strip().upper()
        return " ".join(clean.split())

    @classmethod
    def calculate_utr_signal(cls, bank_utr: Any, candidate_utr: Any) -> Tuple[float, str]:
        bank_utr_clean = clean_str(bank_utr).upper()
        cand_utr_clean = clean_str(candidate_utr).upper()
        
        if not bank_utr_clean or not cand_utr_clean:
            return 0.0, "Missing UTR on one or both sides"
            
        if bank_utr_clean == cand_utr_clean:
            return 1.0, f"Exact UTR match: {bank_utr_clean}"
            
        return 0.0, f"UTR mismatch: {bank_utr_clean} vs {cand_utr_clean}"

    @classmethod
    def calculate_ref_signal(cls, narration: Any, bank_ref: Any, invoice_ref: Any, order_id: Any) -> Tuple[float, str]:
        narration_upper = clean_str(narration).upper()
        bank_ref_upper = clean_str(bank_ref).upper()
        inv_clean = clean_str(invoice_ref).upper()
        order_clean = clean_str(order_id).upper()
        
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
    def calculate_name_signal(cls, bank_narration: Any, extracted_name: Any, ledger_name: Any) -> Tuple[float, str]:
        clean_ledger = cls.normalize_text(ledger_name)
        if not clean_ledger:
            return 0.0, "Missing counterparty name on ledger"
            
        candidates_to_test = []
        c_extracted = cls.normalize_text(extracted_name)
        if c_extracted:
            candidates_to_test.append(c_extracted)
        c_bank = cls.normalize_text(bank_narration)
        if c_bank:
            candidates_to_test.append(c_bank)
            
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
    def calculate_amount_signal(cls, bank_amount: Any, gross_amount: Any, fee: Any, refund: Any) -> Tuple[float, str]:
        b_amt = clean_float(bank_amount, 0.0)
        g_amt = clean_float(gross_amount, 0.0)
        f_amt = clean_float(fee, 0.0)
        r_amt = clean_float(refund, 0.0)

        expected_net = round(g_amt - f_amt - r_amt, 2)
        diff_net = abs(round(b_amt - expected_net, 2))
        diff_gross = abs(round(b_amt - g_amt, 2))
        
        # Perfect net match (within ₹1 rounding tolerance)
        if diff_net <= cls.ROUNDING_TOLERANCE:
            return 1.0, f"Exact net amount match (₹{b_amt:.2f} == expected ₹{expected_net:.2f})"
            
        # Gross match without fee deducted at bank
        if diff_gross <= cls.ROUNDING_TOLERANCE:
            return 0.85, f"Gross amount match (₹{b_amt:.2f} == gross ₹{g_amt:.2f}, fee not deducted at bank)"
            
        # Small discrepancy within standard fee range (up to 3.5% of gross or ₹50)
        max_fee_allowance = max(50.0, g_amt * 0.035)
        if diff_net <= max_fee_allowance:
            score = max(0.5, 1.0 - (diff_net / max_fee_allowance) * 0.5)
            return score, f"Amount close within fee margin (gap: ₹{diff_net:.2f})"
            
        return 0.0, f"Significant amount mismatch: bank ₹{b_amt:.2f} vs expected net ₹{expected_net:.2f}"

    @classmethod
    def calculate_date_signal(cls, bank_date_str: Any, ledger_date_str: Any) -> Tuple[float, str]:
        s_bank = clean_str(bank_date_str)
        s_ledger = clean_str(ledger_date_str)
        if not s_bank or not s_ledger:
            return 0.0, "Missing date on bank or ledger record"
        try:
            d_bank = datetime.strptime(s_bank[:10], "%Y-%m-%d")
            d_ledger = datetime.strptime(s_ledger[:10], "%Y-%m-%d")
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
        
        bank_amt = clean_float(bank_record.get("amount", 0.0))
        gross_amt = clean_float(ledger_record.get("gross_amount", 0.0))
        fee = clean_float(ledger_record.get("razorpay_fee", 0.0))
        refund = clean_float(ledger_record.get("refund_amount", 0.0))
        
        bank_date = clean_str(bank_record.get("date", ""))
        ledger_date = clean_str(ledger_record.get("expected_settlement_date", ""))
        
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
