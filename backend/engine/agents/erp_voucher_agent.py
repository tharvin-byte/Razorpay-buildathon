import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
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

    @classmethod
    def generate_vouchers_for_run(
        cls,
        run_id: str,
        results: List[ReconciliationResult]
    ) -> ERPVoucherResponse:
        vouchers: List[ERPVoucher] = []
        total_adjustable = 0.0
        vch_idx = 1000

        for r in results:
            if r.status == "matched_with_discrepancy" and r.discrepancies:
                vch_idx += 1
                vch = cls._build_discrepancy_voucher(vch_idx, r)
                if vch:
                    vouchers.append(vch)
                    total_adjustable += vch.total_debit

            elif r.status == "exception" and r.source_type == "bank":
                # Bank orphan -> Suspense Account Voucher
                vch_idx += 1
                vch = cls._build_orphan_suspense_voucher(vch_idx, r)
                if vch:
                    vouchers.append(vch)
                    total_adjustable += vch.total_debit

        all_balanced = all(v.is_balanced for v in vouchers)
        tally_batch_xml = cls._build_tally_batch_xml(run_id, vouchers)

        return ERPVoucherResponse(
            run_id=run_id,
            total_vouchers=len(vouchers),
            total_adjustable_amount=round(total_adjustable, 2),
            all_balanced=all_balanced,
            vouchers=vouchers,
            tally_batch_xml=tally_batch_xml
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

        total_var = 0.0
        reasons = []

        for d in result.discrepancies:
            amt = abs(round(float(d.impact_amount or 0.0), 2))
            if amt <= 0.0:
                continue

            if d.type == "fee_deduction":
                # 1.5% fee + 18% GST decomposition
                base_fee = round(amt / 1.18, 2)
                gst_fee = round(amt - base_fee, 2)

                entries.append(
                    ERPAccountEntry(
                        account_code=cls.CHART_OF_ACCOUNTS["gateway_charges"]["code"],
                        account_name=cls.CHART_OF_ACCOUNTS["gateway_charges"]["name"],
                        debit_amount=base_fee,
                        credit_amount=0.0,
                        narration=f"MDR fee on {result.record_id} (Ref: {ledger.invoice_ref})"
                    )
                )
                if gst_fee > 0:
                    entries.append(
                        ERPAccountEntry(
                            account_code=cls.CHART_OF_ACCOUNTS["gst_input"]["code"],
                            account_name=cls.CHART_OF_ACCOUNTS["gst_input"]["name"],
                            debit_amount=gst_fee,
                            credit_amount=0.0,
                            narration=f"18% GST Input Credit on MDR Fee ({result.record_id})"
                        )
                    )
                total_var += amt
                reasons.append(f"MDR Fee (₹{amt:.2f})")

            elif d.type == "partial_refund":
                entries.append(
                    ERPAccountEntry(
                        account_code=cls.CHART_OF_ACCOUNTS["sales_refunds"]["code"],
                        account_name=cls.CHART_OF_ACCOUNTS["sales_refunds"]["name"],
                        debit_amount=amt,
                        credit_amount=0.0,
                        narration=f"Partial customer refund deducted on {ledger.invoice_ref}"
                    )
                )
                total_var += amt
                reasons.append(f"Partial Refund (₹{amt:.2f})")

            elif d.type == "rounding_difference":
                entries.append(
                    ERPAccountEntry(
                        account_code=cls.CHART_OF_ACCOUNTS["rounding_variance"]["code"],
                        account_name=cls.CHART_OF_ACCOUNTS["rounding_variance"]["name"],
                        debit_amount=amt,
                        credit_amount=0.0,
                        narration=f"Paisa rounding adjustment on {result.record_id}"
                    )
                )
                total_var += amt
                reasons.append(f"Rounding Variance (₹{amt:.2f})")

        if total_var <= 0.0:
            return None

        # Balancing Credit Entry
        entries.append(
            ERPAccountEntry(
                account_code=cls.CHART_OF_ACCOUNTS["settlement_control"]["code"],
                account_name=cls.CHART_OF_ACCOUNTS["settlement_control"]["name"],
                debit_amount=0.0,
                credit_amount=round(total_var, 2),
                narration=f"Net settlement credit clearance on {result.record_id}"
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
        lines = [
            f'  <VOUCHER VCHTYPE="Journal" ACTION="Create">',
            f'    <VOUCHERNUMBER>{vch_id}</VOUCHERNUMBER>',
            f'    <DATE>{vch_date}</DATE>',
            f'    <NARRATION>ReconX Automated Settlement Adjustment for {party}</NARRATION>'
        ]
        for e in entries:
            is_dr = "Yes" if e.debit_amount > 0 else "No"
            amt_val = -e.debit_amount if e.debit_amount > 0 else e.credit_amount
            lines.extend([
                f'    <ALLLEDGERENTRIES.LIST>',
                f'      <LEDGERNAME>{e.account_name}</LEDGERNAME>',
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
