import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from xml.sax.saxutils import escape as xml_escape
from backend.models.schemas import (
    ReconciliationResult, ERPVoucher, ERPAccountEntry, ERPVoucherResponse
)

class ERPVoucherAgent:
    """
    Autonomous Self-Healing ERP Agent:
    Translates detected financial variances (MDR fee gaps, timing lags, partial refunds, rounding)
    into standard double-entry bookkeeping vouchers adhering to Indian GAAP / Ind AS.
    
    Guarantees the strict mathematical invariant:
        ∑ Debit == ∑ Credit (Zero Unbalanced Vouchers)
        
    Generates:
    - Tally Prime / ERP 9 XML (<VOUCHER> schema)
    - SAP S/4HANA & Zoho Books JSON journal payloads
    """

    CHART_OF_ACCOUNTS = {
        "gateway_charges": {"code": "4010", "name": "Payment Gateway Charges A/C"},
        "gst_input": {"code": "2210", "name": "GST Input Tax Credit A/C (18%)"},
        "settlement_control": {"code": "1020", "name": "Razorpay Nodal Settlement Control A/C"},
        "rounding_variance": {"code": "4090", "name": "Paisa Rounding Variance A/C"},
        "sales_refunds": {"code": "5020", "name": "Customer Sales Returns & Refunds A/C"},
        "forex_variance": {"code": "4030", "name": "Foreign Exchange Fluctuation A/C"},
        "suspense_clearing": {"code": "1099", "name": "Unreconciled Bank Suspense A/C"}
    }

    APPROVED_ACCOUNTING_TYPES = {"partial_refund", "rounding_difference"}

    @classmethod
    def generate_vouchers_for_run(
        cls,
        run_id: str,
        results: List[ReconciliationResult]
    ) -> ERPVoucherResponse:
        vouchers: List[ERPVoucher] = []
        manual_review_items = []
        total_adjustable = 0.0
        vch_idx = 1000

        for r in results:
            if r.status == "matched_with_discrepancy" and r.discrepancies:
                informational_types = {"timing_lag", "reference_formatting", "none"}
                review_discrepancies = [
                    d for d in r.discrepancies
                    if d.type not in cls.APPROVED_ACCOUNTING_TYPES | informational_types
                ]
                if review_discrepancies:
                    manual_review_items.append({
                        "record_id": r.record_id,
                        "discrepancy_types": sorted({d.type for d in review_discrepancies}),
                        "reason": "Available source data does not establish the accounting treatment.",
                    })
                    continue
                vch_idx += 1
                vch = cls._build_discrepancy_voucher(vch_idx, r)
                if vch:
                    vouchers.append(vch)
                    total_adjustable += vch.total_debit

            elif r.status == "exception" and r.source_type == "bank":
                manual_review_items.append({
                    "record_id": r.record_id,
                    "discrepancy_types": ["unattributed_bank_credit"],
                    "reason": "Source data does not establish a ledger account or posting treatment.",
                })

        all_balanced = bool(vouchers) and all(v.is_balanced for v in vouchers)
        tally_batch_xml = cls._build_tally_batch_xml(run_id, vouchers)

        return ERPVoucherResponse(
            run_id=run_id,
            total_vouchers=len(vouchers),
            total_adjustable_amount=round(total_adjustable, 2),
            all_balanced=all_balanced,
            vouchers=vouchers,
            tally_batch_xml=tally_batch_xml,
            manual_review_items=manual_review_items
        )

    @classmethod
    def _build_discrepancy_voucher(
        cls,
        idx: int,
        result: ReconciliationResult
    ) -> Optional[ERPVoucher]:
        bank = result.bank_record
        ledger = result.matched_ledger_record
        if not bank or not ledger:
            return None

        vch_date = str(bank.date)[:10].replace("-", "")
        formatted_date = str(bank.date)[:10]
        vch_id = f"VCH-{formatted_date}-{idx:04d}"
        entries: List[ERPAccountEntry] = []

        bank_amt = float(bank.amount or 0.0)
        gross_amt = float(ledger.gross_amount or 0.0)
        fee = float(ledger.razorpay_fee or 0.0)
        refund = float(ledger.refund_amount or 0.0)
        expected_net = round(gross_amt - fee - refund, 2)
        net_delta = round(bank_amt - expected_net, 2)
        reasons = []

        for d in result.discrepancies:
            amt = abs(round(float(d.impact_amount or 0.0), 2))
            if amt <= 0.0:
                continue

            if d.type == "partial_refund":
                entries.append(
                    ERPAccountEntry(
                        account_code=cls.CHART_OF_ACCOUNTS["sales_refunds"]["code"],
                        account_name=cls.CHART_OF_ACCOUNTS["sales_refunds"]["name"],
                        debit_amount=amt,
                        credit_amount=0.0,
                        narration=f"Partial customer refund deducted on {ledger.invoice_ref}"
                    )
                )
                reasons.append(f"Partial Refund (₹{amt:.2f})")

            elif d.type == "rounding_difference":
                if net_delta > 0.0:
                    entries.append(
                        ERPAccountEntry(
                            account_code=cls.CHART_OF_ACCOUNTS["rounding_variance"]["code"],
                            account_name=cls.CHART_OF_ACCOUNTS["rounding_variance"]["name"],
                            debit_amount=0.0,
                            credit_amount=amt,
                            narration=f"Paisa rounding gain adjustment on {result.record_id}"
                        )
                    )
                    reasons.append(f"Rounding Gain (+₹{amt:.2f})")
                else:
                    entries.append(
                        ERPAccountEntry(
                            account_code=cls.CHART_OF_ACCOUNTS["rounding_variance"]["code"],
                            account_name=cls.CHART_OF_ACCOUNTS["rounding_variance"]["name"],
                            debit_amount=amt,
                            credit_amount=0.0,
                            narration=f"Paisa rounding expense adjustment on {result.record_id}"
                        )
                    )
                    reasons.append(f"Rounding Variance (₹{amt:.2f})")

        if not entries:
            return None

        # Balancing Entry on Settlement Control Account
        curr_deb = round(sum(e.debit_amount for e in entries), 2)
        curr_cred = round(sum(e.credit_amount for e in entries), 2)
        diff = round(curr_deb - curr_cred, 2)

        if diff > 0.0:
            entries.append(
                ERPAccountEntry(
                    account_code=cls.CHART_OF_ACCOUNTS["settlement_control"]["code"],
                    account_name=cls.CHART_OF_ACCOUNTS["settlement_control"]["name"],
                    debit_amount=0.0,
                    credit_amount=diff,
                    narration=f"Net settlement credit clearance on {result.record_id}"
                )
            )
        elif diff < 0.0:
            entries.append(
                ERPAccountEntry(
                    account_code=cls.CHART_OF_ACCOUNTS["settlement_control"]["code"],
                    account_name=cls.CHART_OF_ACCOUNTS["settlement_control"]["name"],
                    debit_amount=abs(diff),
                    credit_amount=0.0,
                    narration=f"Net settlement debit clearance on {result.record_id}"
                )
            )

        total_deb = round(sum(e.debit_amount for e in entries), 2)
        total_cred = round(sum(e.credit_amount for e in entries), 2)
        is_balanced = abs(total_deb - total_cred) < 0.01

        tally_xml = cls._format_single_tally_xml(vch_id, vch_date, ledger.counterparty_name, entries)
        sap_json = cls._format_single_sap_json(vch_id, formatted_date, ledger.counterparty_name, entries)

        return ERPVoucher(
            voucher_id=vch_id,
            voucher_type="Journal",
            voucher_date=formatted_date,
            reference_txn_id=result.record_id,
            utr_number=bank.utr_number,
            counterparty_name=ledger.counterparty_name,
            entries=entries,
            total_debit=total_deb,
            total_credit=total_cred,
            is_balanced=is_balanced,
            tally_xml_payload=tally_xml,
            sap_json_payload=sap_json,
            adjustment_reason="; ".join(reasons)
        )

    @classmethod
    def _build_orphan_suspense_voucher(
        cls,
        idx: int,
        result: ReconciliationResult
    ) -> Optional[ERPVoucher]:
        bank = result.bank_record
        if not bank:
            return None

        amt = round(float(bank.amount), 2)
        vch_date = str(bank.date)[:10].replace("-", "")
        formatted_date = str(bank.date)[:10]
        vch_id = f"VCH-{formatted_date}-{idx:04d}"

        entries = [
            ERPAccountEntry(
                account_code=cls.CHART_OF_ACCOUNTS["settlement_control"]["code"],
                account_name=cls.CHART_OF_ACCOUNTS["settlement_control"]["name"],
                debit_amount=amt,
                credit_amount=0.0,
                narration=f"Bank credit received without matching ledger: {result.record_id}"
            ),
            ERPAccountEntry(
                account_code=cls.CHART_OF_ACCOUNTS["suspense_clearing"]["code"],
                account_name=cls.CHART_OF_ACCOUNTS["suspense_clearing"]["name"],
                debit_amount=0.0,
                credit_amount=amt,
                narration=f"Suspense allocation pending merchant identification (UTR: {bank.utr_number})"
            )
        ]

        tally_xml = cls._format_single_tally_xml(vch_id, vch_date, "Unidentified Bank Deposit", entries)
        sap_json = cls._format_single_sap_json(vch_id, formatted_date, "Unidentified Bank Deposit", entries)

        return ERPVoucher(
            voucher_id=vch_id,
            voucher_type="Journal",
            voucher_date=formatted_date,
            reference_txn_id=result.record_id,
            utr_number=bank.utr_number,
            counterparty_name="Unidentified Remitter (Suspense)",
            entries=entries,
            total_debit=amt,
            total_credit=amt,
            is_balanced=True,
            tally_xml_payload=tally_xml,
            sap_json_payload=sap_json,
            adjustment_reason="Unclaimed Bank Credit (Quarantined to Suspense A/C)"
        )

    @classmethod
    def _format_single_tally_xml(
        cls,
        vch_id: str,
        vch_date: str,
        party: str,
        entries: List[ERPAccountEntry]
    ) -> str:
        safe_id = xml_escape(str(vch_id))
        safe_date = xml_escape(str(vch_date))
        safe_narration = xml_escape(f"ReconX Automated Settlement Adjustment for {party}")
        lines = [
            f'  <VOUCHER VCHTYPE="Journal" ACTION="Create">',
            f'    <VOUCHERNUMBER>{safe_id}</VOUCHERNUMBER>',
            f'    <DATE>{safe_date}</DATE>',
            f'    <NARRATION>{safe_narration}</NARRATION>'
        ]
        for e in entries:
            is_dr = "Yes" if e.debit_amount > 0 else "No"
            amt_val = -e.debit_amount if e.debit_amount > 0 else e.credit_amount
            safe_ledger = xml_escape(str(e.account_name))
            lines.extend([
                f'    <ALLLEDGERENTRIES.LIST>',
                f'      <LEDGERNAME>{safe_ledger}</LEDGERNAME>',
                f'      <ISDEEMEDPOSITIVE>{is_dr}</ISDEEMEDPOSITIVE>',
                f'      <AMOUNT>{amt_val:.2f}</AMOUNT>',
                f'    </ALLLEDGERENTRIES.LIST>'
            ])
        lines.append('  </VOUCHER>')
        return "\n".join(lines)

    @classmethod
    def _format_single_sap_json(
        cls,
        vch_id: str,
        formatted_date: str,
        party: str,
        entries: List[ERPAccountEntry]
    ) -> Dict[str, Any]:
        return {
            "DocumentNumber": vch_id,
            "DocumentDate": formatted_date,
            "CompanyCode": "1000",
            "Currency": "INR",
            "DocumentType": "SA",
            "HeaderNarration": f"ReconX Auto-Adjustment for {party}",
            "Items": [
                {
                    "ItemNo": i + 1,
                    "AccountCode": e.account_code,
                    "AccountName": e.account_name,
                    "DebitCredit": "S" if e.debit_amount > 0 else "H",
                    "Amount": e.debit_amount if e.debit_amount > 0 else e.credit_amount,
                    "Text": e.narration
                }
                for i, e in enumerate(entries)
            ]
        }

    @classmethod
    def _build_tally_batch_xml(cls, run_id: str, vouchers: List[ERPVoucher]) -> str:
        header = f"""<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>ReconX Merchant General Ledger</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
<!-- ReconX Run {run_id} Auto-Generated ERP Adjustments -->"""

        footer = """        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""

        body_lines = [v.tally_xml_payload for v in vouchers]
        return header + "\n" + "\n".join(body_lines) + "\n" + footer
