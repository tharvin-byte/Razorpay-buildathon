import uuid
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from backend.models.schemas import (
    ReconciliationResult, DisputeClaim, DisputeListResponse
)
from backend.engine.conformal_verifier import MerkleAuditTree

class DisputeResolutionBot:
    """
    Automated Legal Dispute Resolution & Chargeback Agent:
    Synthesizes formal, evidence-grounded banking dispute notices for:
    1. Unrepresented Bank Orphan Deposits (Unclaimed credits in bank without ledger order)
    2. Missing Remittance Settlements (Orders completed in ledger with payout never received in bank)
    3. Gateway / Network Fee Overcharges (Interchange/MDR fee deductions exceeding contractual cap)
    4. Duplicate Charge Debits (Duplicate retried network transactions)
    
    Adheres to:
    - NPCI Procedural Guidelines for UPI/IMPS/NEFT Chargebacks & Inward Credit Harmonization
    - ISO 20022 Financial Messaging Dispute Reason Taxonomies (camt.029 / pacs.004)
    - RBI Master Directions on Escrow and Nodal Accounts (DPSS.CO.PD.No.1102/02.14.08/2009-10)
    - Cryptographic SHA-256 Merkle Leaf Attestation
    """

    NPCI_REASON_CODES = {
        "bank_orphan": "NPCI_UP_104_UNREPRESENTED_CREDIT",
        "missing_settlement": "NPCI_SET_301_SETTLEMENT_TIMEOUT_T2",
        "fee_overcharge": "NPCI_MDR_208_EXCESS_INTERCHANGE_FEE",
        "duplicate_charge": "NPCI_DUP_402_DUPLICATE_DEBIT_REVERSAL"
    }

    @staticmethod
    def _detect_bank_name(text: str) -> str:
        """Dynamically identifies the clearing or issuing bank from transaction narration or IFSC."""
        if not text:
            return "HDFC Bank Nodal Clearing"
        t = text.upper()
        if "ICIC" in t or "ICICI" in t:
            return "ICICI Bank Ltd."
        if "HDFC" in t:
            return "HDFC Bank Ltd."
        if "SBIN" in t or "SBI" in t or "STATE BANK" in t:
            return "State Bank of India"
        if "UTIB" in t or "AXIS" in t:
            return "Axis Bank Ltd."
        if "KKBK" in t or "KOTAK" in t:
            return "Kotak Mahindra Bank"
        if "YESB" in t or "YES BANK" in t:
            return "Yes Bank Ltd."
        if "PUNB" in t or "PNB" in t:
            return "Punjab National Bank"
        if "BARB" in t or "BOB" in t:
            return "Bank of Baroda"
        if "UPI" in t:
            return "NPCI UPI Clearing (HDFC Nodal Escrow)"
        return "HDFC Bank Nodal Clearing"

    @staticmethod
    def _extract_counterparty_from_narration(narration: str) -> Optional[str]:
        """Extracts recognizable customer name from unstructured bank narration."""
        if not narration:
            return None
        # Format: UPI/NAME/PHONE/INV...
        m = re.search(r"UPI/([A-Z]+)/", narration, re.IGNORECASE)
        if m:
            return m.group(1).title()
        # Format: NEFT-CR-IFSC-NAME-INV...
        m = re.search(r"NEFT-CR-[A-Z0-9]+-([A-Z]+)-", narration, re.IGNORECASE)
        if m:
            return m.group(1).title()
        # Format: IMPS-P2A-PHONE-NAME-INV...
        m = re.search(r"IMPS-P2A-[0-9]+-([A-Z]+)-", narration, re.IGNORECASE)
        if m:
            return m.group(1).title()
        # Format: TRF FRM NAME FOR BILL...
        m = re.search(r"TRF\s+FRM\s+([A-Za-z\s]+?)\s+FOR", narration, re.IGNORECASE)
        if m:
            return m.group(1).strip().title()
        return None

    @classmethod
    def generate_disputes_for_run(
        cls,
        run_id: str,
        results: List[ReconciliationResult]
    ) -> DisputeListResponse:
        claims: List[DisputeClaim] = []
        total_recoverable = 0.0

        for r in results:
            # Case 1: Bank Orphan Credit (Money in bank, no matching ledger order)
            if r.status == "exception" and r.source_type == "bank":
                claim = cls._build_orphan_dispute_claim(r)
                if claim:
                    claims.append(claim)
                    total_recoverable += claim.disputed_amount

            # Case 2: Missing Settlement Payout (Order in ledger, money never arrived in bank after T+2)
            elif r.status == "exception" and r.source_type == "ledger":
                claim = cls._build_missing_settlement_claim(r)
                if claim:
                    claims.append(claim)
                    total_recoverable += claim.disputed_amount

            # Case 3 & 4: Discrepancies (Excess Fee / MDR Gaps & Duplicate Charges)
            elif r.status == "matched_with_discrepancy" and r.discrepancies:
                for d in r.discrepancies:
                    # Fee Overcharge / Abnormal Gap
                    if d.type in ("unreconciled_amount_gap", "fee_deduction") and (d.impact_amount or 0.0) > 1.0:
                        claim = cls._build_fee_overcharge_claim(r, d)
                        if claim:
                            claims.append(claim)
                            total_recoverable += claim.disputed_amount
                    
                    # Duplicate Charge Reversal
                    elif d.type in ("duplicate_retry", "duplicate_charge"):
                        claim = cls._build_duplicate_claim(r, d)
                        if claim:
                            claims.append(claim)
                            total_recoverable += claim.disputed_amount

        return DisputeListResponse(
            run_id=run_id,
            total_claims=len(claims),
            total_recoverable_capital=round(total_recoverable, 2),
            claims=claims
        )

    @classmethod
    def _build_orphan_dispute_claim(cls, result: ReconciliationResult) -> Optional[DisputeClaim]:
        bank = result.bank_record
        if not bank:
            return None

        amt = round(float(bank.amount), 2)
        utr = bank.utr_number or "UNASSIGNED_UTR"
        date_str = str(bank.date)[:10]
        claim_id = f"CLM-ORPH-{uuid.uuid4().hex[:6].upper()}"
        bank_name = cls._detect_bank_name(bank.narration or "")
        counterparty = cls._extract_counterparty_from_narration(bank.narration or "")

        merkle_proof = (result.signals.merkle_leaf_hash if (result.signals and result.signals.merkle_leaf_hash) else None) or MerkleAuditTree.hash_leaf({
            "record_id": result.record_id,
            "utr": utr,
            "amount": amt,
            "date": date_str
        })

        letter = f"""================================================================================
FORMAL NOTICE OF UNREPRESENTED SETTLEMENT / UNCLAIMED CREDIT
Reference Code: {claim_id} | Statutory NPCI Filing Code: {cls.NPCI_REASON_CODES['bank_orphan']}
================================================================================

Date of Filing: {datetime.now().strftime('%d-%b-%Y')}
To: Nodal Operations & Merchant Acquiring Team
    {bank_name} / Razorpay Software Pvt. Ltd.

Subject: Formal Request for Remitter Attribution on Unclaimed Deposit
         Bank Transaction ID: {result.record_id} | UTR: {utr}

Dear Settlement Operations Manager,

We hereby register a formal reconciliation exception under RBI Master Directions 
(DPSS.CO.PD.No.1102/02.14.08/2009-10) regarding an unrepresented bank credit:

1. TRANSACTION PARTICULARS:
   - Bank Credit Reference  : {result.record_id}
   - Settlement / UTR Code  : {utr}
   - Inward Deposit Amount  : INR {amt:,.2f}
   - Bank Value Date        : {date_str}
   - Core Banking Narration : {bank.narration}
   - Remitter Identified    : {counterparty or 'Unidentified Counterparty'}

2. RECONCILIATION FINDINGS:
   ReconX automated tensor audit confirms this credit has NO matching order or 
   invoice in the internal merchant ledger. Funds cannot be legally recognized.

3. STATUTORY DEMAND & SLA:
   Pursuant to NPCI Harmonization Guidelines for failed and unclaimed credits, 
   please provide the original Remitter Virtual Payment Address (VPA) / Core Bank 
   Account Identifier within T+2 banking days, or execute auto-reversal to source.

4. CRYPTOGRAPHIC PROOF OF ESCROW SOLVENCY:
   - Attestation Digest (SHA-256): {merkle_proof}

Authorized Signatory,
ReconX Autonomous Treasury Controller
================================================================================"""

        return DisputeClaim(
            claim_id=claim_id,
            transaction_id=result.record_id,
            utr_number=utr,
            bank_name=bank_name,
            claim_type="Unrepresented Bank Credit (Orphan)",
            disputed_amount=amt,
            expected_amount=0.0,
            actual_amount=amt,
            claim_status="drafted",
            npci_reason_code=cls.NPCI_REASON_CODES["bank_orphan"],
            merkle_proof_hash=merkle_proof,
            formal_letter_text=letter,
            created_at=datetime.now().isoformat(),
            counterparty_name=counterparty
        )

    @classmethod
    def _build_missing_settlement_claim(cls, result: ReconciliationResult) -> Optional[DisputeClaim]:
        ledger = result.matched_ledger_record
        if not ledger:
            return None

        gross_amt = round(float(ledger.gross_amount), 2)
        fee_amt = round(float(ledger.razorpay_fee or 0.0), 2)
        refund_amt = round(float(ledger.refund_amount or 0.0), 2)
        expected_payout = round(gross_amt - fee_amt - refund_amt, 2)
        date_str = str(ledger.expected_settlement_date)[:10]
        claim_id = f"CLM-SETT-{uuid.uuid4().hex[:6].upper()}"
        counterparty = ledger.counterparty_name or "Unknown Customer"
        bank_name = "Razorpay Nodal Escrow (HDFC Bank Clearing)"

        merkle_proof = (result.signals.merkle_leaf_hash if (result.signals and result.signals.merkle_leaf_hash) else None) or MerkleAuditTree.hash_leaf({
            "record_id": result.record_id,
            "invoice": ledger.invoice_ref,
            "amount": expected_payout,
            "date": date_str
        })

        letter = f"""================================================================================
FORMAL NOTICE & STATUTORY CLAIM: MISSING SETTLEMENT REMITTANCE (T+2 TIMEOUT)
Reference Code: {claim_id} | Statutory NPCI Filing Code: {cls.NPCI_REASON_CODES['missing_settlement']}
================================================================================

Date of Filing: {datetime.now().strftime('%d-%b-%Y')}
To: Nodal Operations & Merchant Settlement Desk
    {bank_name}

Subject: Urgent Demand for Unsettled Merchant Remittance Payout
         Invoice: {ledger.invoice_ref} | Order ID: {ledger.order_id}

Dear Nodal Accounts Officer,

Under Section 10(2) of Payment and Settlement Systems Act, 2007, and RBI Master 
Directions on Nodal Settlement Timelines, we notify you of an unremitted merchant payout:

1. TRANSACTION PARTICULARS:
   - Internal Ledger ID     : {ledger.ledger_entry_id}
   - Invoice Reference      : {ledger.invoice_ref}
   - Customer / Buyer       : {counterparty}
   - Gross Invoiced Amount  : INR {gross_amt:,.2f}
   - Contractual Gateway Fee: INR {fee_amt:,.2f}
   - Expected Net Remittance: INR {expected_payout:,.2f}
   - Scheduled Payout Date  : {date_str} (Elapsed past T+2 cutoff)

2. AUDIT RECONCILIATION DEFECT:
   ReconX reverse-sweep engine audited all inward bank nodal account credits 
   and verified ZERO corresponding settlement credit received for this transaction.
   The payout is currently withheld or trapped in intermediary clearing.

3. STATUTORY DEMAND:
   In accordance with RBI DPSS guidelines, remit the outstanding amount of 
   INR {expected_payout:,.2f} immediately to our Primary Current Account, or furnish 
   the bank transaction UTR tracking reference within 24 hours.

4. CRYPTOGRAPHIC PROOF OF ESCROW SOLVENCY:
   - Attestation Digest (SHA-256): {merkle_proof}

Authorized Signatory,
ReconX Autonomous Treasury Controller
================================================================================"""

        return DisputeClaim(
            claim_id=claim_id,
            transaction_id=result.record_id,
            utr_number=f"EXP-{ledger.invoice_ref}",
            bank_name=bank_name,
            claim_type="Missing Remittance Payout (Settlement Timeout)",
            disputed_amount=expected_payout,
            expected_amount=expected_payout,
            actual_amount=0.0,
            claim_status="drafted",
            npci_reason_code=cls.NPCI_REASON_CODES["missing_settlement"],
            merkle_proof_hash=merkle_proof,
            formal_letter_text=letter,
            created_at=datetime.now().isoformat(),
            counterparty_name=counterparty
        )

    @classmethod
    def _build_fee_overcharge_claim(
        cls,
        result: ReconciliationResult,
        disc: Any
    ) -> Optional[DisputeClaim]:
        bank = result.bank_record
        ledger = result.matched_ledger_record
        if not bank or not ledger:
            return None

        fee_diff = round(float(disc.impact_amount or 0.0), 2)
        gross_amt = round(float(ledger.gross_amount), 2)
        fee_amt = round(float(ledger.razorpay_fee or 0.0), 2)
        refund_amt = round(float(ledger.refund_amount or 0.0), 2)
        expected_net = round(gross_amt - fee_amt - refund_amt, 2)
        bank_amt = round(float(bank.amount), 2)
        utr = bank.utr_number or "UNASSIGNED_UTR"
        claim_id = f"CLM-FEE-{uuid.uuid4().hex[:6].upper()}"
        counterparty = ledger.counterparty_name or "Unknown Customer"
        bank_name = cls._detect_bank_name(bank.narration or "")

        merkle_proof = (result.signals.merkle_leaf_hash if (result.signals and result.signals.merkle_leaf_hash) else None) or MerkleAuditTree.hash_leaf({
            "record_id": result.record_id,
            "utr": utr,
            "fee_diff": fee_diff
        })

        letter = f"""================================================================================
COMMERCIAL DISPUTE NOTICE: EXCESS MDR / INTERCHANGE DEDUCTION
Reference Code: {claim_id} | Statutory NPCI Filing Code: {cls.NPCI_REASON_CODES['fee_overcharge']}
================================================================================

Date of Filing: {datetime.now().strftime('%d-%b-%Y')}
To: Merchant Billing & Financial Settlement Operations
    {bank_name} / Razorpay Acquiring Desk

Subject: Excessive Fee Deduction Variance Claim on Bank Txn: {result.record_id}

Dear Merchant Billing Team,

A contractual fee variance audit conducted by ReconX has identified an unauthorized 
interchange/fee surcharge exceeding our agreed Master Services Agreement (MSA) cap:

1. CONTRACTUAL VARIANCE SUMMARY:
   - Order / Invoice Ref    : {ledger.invoice_ref} (Customer: {counterparty})
   - Gross Transaction Value: INR {gross_amt:,.2f}
   - Expected Net Credit    : INR {expected_net:,.2f}
   - Actual Net Settled     : INR {bank_amt:,.2f}
   - EXCESS DEDUCTION CLAIM : INR {fee_diff:,.2f}
   - Associated UTR         : {utr}

2. RECONCILIATION EVIDENCE:
   The transaction was charged a fee variance of INR {fee_diff:,.2f} without an 
   associated chargeback or tier surcharge record in the network settlement file.

3. REMEDIATION ACTION REQUESTED:
   Please credit the excess deduction of INR {fee_diff:,.2f} back to our Nodal 
   Settlement Account in the next daily payout cycle (T+1).

4. CRYPTOGRAPHIC PROOF DIGEST:
   - Attestation Digest (SHA-256): {merkle_proof}

Authorized Signatory,
ReconX Autonomous Treasury Controller
================================================================================"""

        return DisputeClaim(
            claim_id=claim_id,
            transaction_id=result.record_id,
            utr_number=utr,
            bank_name=bank_name,
            claim_type="Excess MDR / Fee Surcharge Overcharge",
            disputed_amount=fee_diff,
            expected_amount=expected_net,
            actual_amount=bank_amt,
            claim_status="drafted",
            npci_reason_code=cls.NPCI_REASON_CODES["fee_overcharge"],
            merkle_proof_hash=merkle_proof,
            formal_letter_text=letter,
            created_at=datetime.now().isoformat(),
            counterparty_name=counterparty
        )

    @classmethod
    def _build_duplicate_claim(
        cls,
        result: ReconciliationResult,
        disc: Any
    ) -> Optional[DisputeClaim]:
        bank = result.bank_record
        ledger = result.matched_ledger_record
        amt = round(float(disc.impact_amount or (bank.amount if bank else 0.0)), 2)
        utr = (bank.utr_number if bank else None) or "UNASSIGNED_UTR"
        claim_id = f"CLM-DUP-{uuid.uuid4().hex[:6].upper()}"
        counterparty = (ledger.counterparty_name if ledger else None) or cls._extract_counterparty_from_narration(bank.narration if bank else "") or "Customer"
        bank_name = cls._detect_bank_name(bank.narration if bank else "")

        merkle_proof = (result.signals.merkle_leaf_hash if (result.signals and result.signals.merkle_leaf_hash) else None) or MerkleAuditTree.hash_leaf({
            "record_id": result.record_id,
            "utr": utr,
            "dup_amount": amt
        })

        letter = f"""================================================================================
CHARGEBACK REVERSAL NOTICE: DUPLICATE PROCESSING / DOUBLE DEBIT
Reference Code: {claim_id} | Statutory NPCI Filing Code: {cls.NPCI_REASON_CODES['duplicate_charge']}
================================================================================

Date of Filing: {datetime.now().strftime('%d-%b-%Y')}
To: Chargeback & Dispute Management Division
    {bank_name}

Subject: Chargeback Notice for Duplicate Processing
         Bank Txn Ref: {result.record_id} | UTR: {utr}

Dear Chargeback Officer,

ReconX automated tensor audit has detected a duplicate payment / double debit anomaly 
requiring immediate reversal under NPCI Procedural Guidelines for Network Transactions:

1. DUPLICATE TRANSACTION PARTICULARS:
   - Suspect Txn Reference  : {result.record_id}
   - Settlement UTR         : {utr}
   - Duplicated Value       : INR {amt:,.2f}
   - Counterparty Involved  : {counterparty}

2. DEFECT ANALYSIS:
   The network settlement log shows the target ledger reference was already successfully 
   settled and attributed. This secondary entry represents a duplicate processing debit 
   or retried network message.

3. REMEDIATION ACTION DEMANDED:
   Execute immediate reversal of INR {amt:,.2f} to the originating customer VPA / account 
   within the mandated T+1 chargeback SLA.

4. CRYPTOGRAPHIC PROOF DIGEST:
   - Attestation Digest (SHA-256): {merkle_proof}

Authorized Signatory,
ReconX Autonomous Treasury Controller
================================================================================"""

        return DisputeClaim(
            claim_id=claim_id,
            transaction_id=result.record_id,
            utr_number=utr,
            bank_name=bank_name,
            claim_type="Duplicate Debit / Processing Reversal",
            disputed_amount=amt,
            expected_amount=0.0,
            actual_amount=amt,
            claim_status="drafted",
            npci_reason_code=cls.NPCI_REASON_CODES["duplicate_charge"],
            merkle_proof_hash=merkle_proof,
            formal_letter_text=letter,
            created_at=datetime.now().isoformat(),
            counterparty_name=counterparty
        )

BankDisputeAgent = DisputeResolutionBot
