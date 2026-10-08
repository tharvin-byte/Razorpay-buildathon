import re
from typing import List, Dict, Any, Tuple
from backend.models.schemas import ReconciliationResult, SummaryResponse
from backend.engine.llm_gateway import get_gemini_client, generate_content

class ReconciliationAssistant:
    """
    ReconX run assistant:
    Summarizes recorded reconciliation results and states when information is unavailable.

    Supports:
    - Google Gemini API when an API key is present and under quota
    - Natural Language Conversational Engine with live computational analytics across all transactions
    - Contextual lookup of recorded transactions and discrepancies
    """
    
    def __init__(self):
        pass

    def _init_llm_client(self):
        """Initializes or refreshes the LLM gateway client."""
        return get_gemini_client()

    @property
    def client(self):
        return get_gemini_client()

    def _calculate_run_analytics(self, results: List[ReconciliationResult]) -> Dict[str, Any]:
        """Pre-computes granular financial rankings and discrepancy metrics across all results."""
        diff_txns = []
        highest_bank_txns = []
        highest_ledger_txns = []
        bank_orphans = []
        ledger_orphans = []
        refund_txns = []
        timing_txns = []
        rounding_txns = []
        fee_gap_txns = []
        customers_map: Dict[str, List[ReconciliationResult]] = {}
        
        for r in results:
            # Map customers
            cust_name = None
            if r.matched_ledger_record and r.matched_ledger_record.counterparty_name:
                cust_name = r.matched_ledger_record.counterparty_name.strip()
            elif r.bank_record and r.bank_record.narration:
                m = re.search(r'(?:UPI|CR-[A-Z0-9]+|IMPS-P2A-[0-9]+|TRF FRM)\/([A-Z\s]+?)(?:\/|-|\sFOR)', r.bank_record.narration, re.IGNORECASE)
                if m:
                    cust_name = m.group(1).strip().title()
            
            if cust_name:
                customers_map.setdefault(cust_name.lower(), []).append(r)

            # Bank orphans
            if r.source_type == "bank" and r.status == "exception" and r.bank_record:
                bank_orphans.append({
                    "id": r.record_id,
                    "amount": float(r.bank_record.amount),
                    "narration": r.bank_record.narration or "",
                    "utr": r.bank_record.utr_number or "UNASSIGNED"
                })

            # Ledger orphans
            elif r.source_type == "ledger" and r.status == "exception" and r.matched_ledger_record:
                ledger_orphans.append({
                    "id": r.record_id,
                    "gross": float(r.matched_ledger_record.gross_amount),
                    "customer": r.matched_ledger_record.counterparty_name or "Unknown",
                    "invoice": r.matched_ledger_record.invoice_ref or "",
                    "reason": r.exception_reason or "Missing bank settlement"
                })

            # Matched with discrepancies
            elif r.status == "matched_with_discrepancy" and r.bank_record and r.matched_ledger_record:
                b_amt = float(r.bank_record.amount)
                gross = float(r.matched_ledger_record.gross_amount)
                fee = float(r.matched_ledger_record.razorpay_fee or 0.0)
                ref = float(r.matched_ledger_record.refund_amount or 0.0)
                expected_net = gross - fee - ref
                delta = abs(b_amt - expected_net)
                max_impact = max([float(d.impact_amount or 0.0) for d in r.discrepancies], default=0.0)
                primary_diff = max(delta, max_impact)
                
                entry = {
                    "id": r.record_id,
                    "diff": primary_diff,
                    "bank_amount": b_amt,
                    "gross_amount": gross,
                    "expected_net": expected_net,
                    "customer": r.matched_ledger_record.counterparty_name or "Customer",
                    "utr": r.bank_record.utr_number or "",
                    "discrepancies": [d.description for d in r.discrepancies],
                    "types": [d.type for d in r.discrepancies],
                    "explanation": r.explanation or ""
                }
                diff_txns.append(entry)

                for d in r.discrepancies:
                    if d.type == "partial_refund":
                        refund_txns.append(entry)
                    elif d.type == "timing_lag":
                        timing_txns.append(entry)
                    elif d.type == "rounding_difference":
                        rounding_txns.append(entry)
                    elif d.type in ("unreconciled_amount_gap", "fee_deduction"):
                        fee_gap_txns.append(entry)

            # Global rankings
            if r.bank_record:
                highest_bank_txns.append({
                    "id": r.record_id,
                    "amount": float(r.bank_record.amount),
                    "customer": (r.matched_ledger_record.counterparty_name if r.matched_ledger_record else None) or r.bank_record.narration or "Bank Inflow"
                })
            if r.matched_ledger_record:
                highest_ledger_txns.append({
                    "id": r.matched_ledger_record.ledger_entry_id,
                    "amount": float(r.matched_ledger_record.gross_amount),
                    "customer": r.matched_ledger_record.counterparty_name or "Merchant Order"
                })

        diff_txns.sort(key=lambda x: -x["diff"])
        highest_bank_txns.sort(key=lambda x: -x["amount"])
        highest_ledger_txns.sort(key=lambda x: -x["amount"])
        bank_orphans.sort(key=lambda x: -x["amount"])
        ledger_orphans.sort(key=lambda x: -x["gross"])
        rounding_txns.sort(key=lambda x: x["diff"])  # Smallest first

        return {
            "top_diff_txns": diff_txns,
            "top_bank_txns": highest_bank_txns[:5],
            "top_ledger_txns": highest_ledger_txns[:5],
            "top_bank_orphans": bank_orphans[:5],
            "top_ledger_orphans": ledger_orphans[:5],
            "refund_txns": refund_txns,
            "timing_txns": timing_txns,
            "rounding_txns": rounding_txns,
            "fee_gap_txns": fee_gap_txns,
            "customers_map": customers_map
        }

    def _build_context_summary(
        self,
        summary: SummaryResponse,
        results: List[ReconciliationResult]
    ) -> str:
        disc_summary_lines = []
        for k, v in summary.discrepancy_breakdown.items():
            if v > 0:
                disc_summary_lines.append(f"  - {k.replace('_', ' ').title()}: {v} records")

        analytics = self._calculate_run_analytics(results)
        
        diff_lines = []
        for item in analytics["top_diff_txns"][:5]:
            diff_lines.append(
                f"  * Txn: {item['id']} | Difference Gap: ₹{item['diff']:,.2f} | Customer: {item['customer']} | "
                f"Bank Received: ₹{item['bank_amount']:,.2f} vs Expected: ₹{item['expected_net']:,.2f} | "
                f"Reasons: {'; '.join(item['discrepancies'])}"
            )

        top_bank_lines = [
            f"  * {b['id']}: ₹{b['amount']:,.2f} ({b['customer']})"
            for b in analytics["top_bank_txns"][:3]
        ]
        top_orphan_lines = [
            f"  * Bank Orphan {bo['id']}: ₹{bo['amount']:,.2f} (Narration: {bo['narration'][:35]})"
            for bo in analytics["top_bank_orphans"][:3]
        ]
        top_missing_settlement_lines = [
            f"  * Missing Settlement {lo['id']}: ₹{lo['gross']:,.2f} (Customer: {lo['customer']}, Invoice: {lo['invoice']})"
            for lo in analytics["top_ledger_orphans"][:3]
        ]

        context = f"""
RECONCILIATION RUN CONTEXT (Run ID: {summary.run_id}):
- Total Bank Records Processed: {summary.total_bank_records}
- Total Internal Ledger Records: {summary.total_ledger_records}
- Clean Matches (Zero Variance): {summary.matched_clean_count}
- Matches with Business Discrepancies: {summary.matched_discrepancy_count}
- Bank-Side Orphan Exceptions (Unclaimed): {summary.exception_bank_count}
- Ledger-Side Orphan Exceptions (Missing Credits): {summary.exception_ledger_count}
- Expected Non-Matches (Gateway Failed): {summary.expected_non_match_count}
- Overall Match Rate: {summary.match_rate*100:.1f}%
- Active Confidence Cutoff (Lambda): {summary.current_threshold}
- SHA-256 result digest: {summary.merkle_root_hash or 'Not available'}

Discrepancy Breakdown:
{chr(10).join(disc_summary_lines)}

KEY FINANCIAL RANKINGS & ANOMALY ANALYSIS:
1. TRANSACTIONS WITH LARGEST AMOUNT DIFFERENCE / VARIANCE:
{chr(10).join(diff_lines)}

2. HIGHEST VALUE BANK DEPOSITS:
{chr(10).join(top_bank_lines)}

3. LARGEST UNCLAIMED BANK ORPHANS (Money in bank without ledger order):
{chr(10).join(top_orphan_lines)}

4. LARGEST UNREMITTED LEDGER ORPHANS (Customer paid, bank payout missing):
{chr(10).join(top_missing_settlement_lines)}
"""
        return context

    def answer_query(
        self,
        question: str,
        summary: SummaryResponse,
        results: List[ReconciliationResult]
    ) -> Tuple[str, List[str]]:
        self._init_llm_client()
        q_clean = question.strip()
        q_lower = q_clean.lower()
        analytics = self._calculate_run_analytics(results)

        # These finance-critical responses are computed from the active run
        # before any language-model or legacy sample-template response.
        if any(word in q_lower for word in ("match rate", "below 80", "investigate first")):
            bank_rate = summary.bank_match_rate * 100
            return (
                f"Bank match rate for run `{summary.run_id}` is **{bank_rate:.1f}%** "
                f"({summary.matched_clean_count + summary.matched_discrepancy_count} of {summary.total_bank_records} bank records).\n\n"
                f"Ledger coverage is **{summary.ledger_coverage_rate * 100:.1f}%** and overall result resolution is "
                f"**{summary.overall_resolution_rate * 100:.1f}%**. Exceptions: {summary.exception_bank_count} bank-side and "
                f"{summary.exception_ledger_count} ledger-side; expected non-matches: {summary.expected_non_match_count}."
            ), []

        if any(word in q_lower for word in ("leakage", "fee leakage", "mdr", "timing lag", "refund deduction")):
            totals = {}
            counts = {}
            for result in results:
                for discrepancy in result.discrepancies:
                    counts[discrepancy.type] = counts.get(discrepancy.type, 0) + 1
                    totals[discrepancy.type] = totals.get(discrepancy.type, 0.0) + abs(float(discrepancy.impact_amount or 0.0))
            rows = [
                f"| {kind.replace('_', ' ').title()} | {counts[kind]} | ₹{totals[kind]:,.2f} |"
                for kind in sorted(counts)
            ] or ["| None recorded | 0 | ₹0.00 |"]
            return (
                f"Discrepancies in run `{summary.run_id}` (impact amounts are summed from recorded results):\n\n"
                "| Type | Records | Recorded impact |\n|---|---:|---:|\n" + "\n".join(rows)
            ), []

        if any(word in q_lower for word in ("merkle", "conformal", "crc", "cryptographic")):
            root = summary.merkle_root_hash or "Not available"
            empirical = (
                f"{summary.evaluation.precision * 100:.1f}%"
                if summary.evaluation else "Not available (no ground-truth evaluation)"
            )
            return (
                f"Run `{summary.run_id}` has SHA-256 result digest `{root}` and observed evaluation precision **{empirical}**. "
                "The current threshold selection is empirical; this implementation does not establish a conformal finite-sample risk guarantee. "
                "The digest is not externally anchored and should not be treated as proof of immutable storage."
            ), []

        if any(word in q_lower for word in ("cfo", "urgent", "investigate first", "priority")):
            priorities = []
            for item in analytics["top_diff_txns"][:3]:
                priorities.append(f"- Variance `{item['id']}`: ₹{item['diff']:,.2f} ({item['customer']})")
            for item in analytics["top_bank_orphans"][:2]:
                priorities.append(f"- Unmatched bank credit `{item['id']}`: ₹{item['amount']:,.2f}")
            for item in analytics["top_ledger_orphans"][:2]:
                priorities.append(f"- Unmatched ledger entry `{item['id']}`: ₹{item['gross']:,.2f}")
            return "Current run priorities:\n\n" + ("\n".join(priorities) or "- No ranked exceptions or variances in this run."), []

        if any(word in q_lower for word in ("tally", "xml", "journal voucher", "erp")):
            return (
                f"ERP voucher data for run `{summary.run_id}` is available from `/run/{summary.run_id}/erp-vouchers`. "
                "Unexplained amount gaps require controller review and are not automatically posted."
            ), []

        if any(word in q_lower for word in ("dispute", "npci", "chargeback", "claim")):
            bank_exceptions = [r for r in results if r.status == "exception" and r.source_type == "bank"]
            ledger_exceptions = [r for r in results if r.status == "exception" and r.source_type == "ledger"]
            exposure = sum(float(r.bank_record.amount) for r in bank_exceptions if r.bank_record)
            return (
                f"Run `{summary.run_id}` contains {len(bank_exceptions)} bank exceptions totaling ₹{exposure:,.2f} "
                f"and {len(ledger_exceptions)} ledger exceptions. Draft claim data, where available, is exposed at "
                f"`/run/{summary.run_id}/disputes`; review supporting records and applicable rules before filing."
            ), [r.record_id for r in bank_exceptions[:5]]
        
        # -----------------------------------------------------------------
        # 1. LLM Grounded Answer via Gemini (when available & quota healthy)
        # -----------------------------------------------------------------
        if self.client:
            context = self._build_context_summary(summary, results)
            system_prompt = f"""You are ReconX, an elite AI Financial Controller and Multi-Agent Treasury Assistant built for Indian Payment Aggregators (RBI Nodal / Escrow accounts).
You have complete analytical knowledge of reconciliation run: {summary.run_id}.

CRITICAL INSTRUCTIONS:
1. Answer from the supplied run context only. State when it lacks enough information.
2. Distinguish recorded facts from hypotheses; do not invent legal, contractual, or accounting requirements.
3. Do not claim posting, verification, or certification unless the context explicitly records it.
4. Use concise Markdown and quote IDs and amounts exactly as supplied.

Context for Run {summary.run_id}:
{context}"""

            answer_text = generate_content(f"{system_prompt}\n\nUser Question: {q_clean}")
            if answer_text:
                relevant_ids = [r.record_id for r in results if r.record_id in answer_text]
                return answer_text.strip(), relevant_ids[:5]

        # 2. Native Computational Financial Intelligence Engine (Fallback)
        # -----------------------------------------------------------------
        
        # A. Customer / Counterparty Name Inquiries
        for c_name, c_records in analytics["customers_map"].items():
            if c_name in q_lower or (len(c_name.split()) > 1 and c_name.split()[0] in q_lower and len(c_name.split()[0]) > 3):
                display_name = c_records[0].matched_ledger_record.counterparty_name if (c_records[0].matched_ledger_record and c_records[0].matched_ledger_record.counterparty_name) else c_name.title()
                rows = []
                for r in c_records:
                    amt = r.bank_record.amount if r.bank_record else (r.matched_ledger_record.gross_amount if r.matched_ledger_record else 0.0)
                    discs = [d.description for d in r.discrepancies] if r.discrepancies else ([r.exception_reason] if r.exception_reason else ["Clean Parity Match"])
                    status_badge = f"`{r.status.upper()}`"
                    rows.append(f"| `{r.record_id}` | **₹{amt:,.2f}** | {status_badge} | {'; '.join(discs)} |")
                
                table_md = "\n".join(rows)
                
                return (
                    f"### ðŸ‘¤ Customer Audit Record: **{display_name}**\n\n"
                    f"Found **{len(c_records)} transaction(s)** associated with **{display_name}** in run `{summary.run_id}`:\n\n"
                    f"| Record ID | Amount | Settlement Status | Audit Findings |\n"
                    f"| :--- | :--- | :--- | :--- |\n"
                    f"{table_md}\n\n"
                    f"**Summary Analysis:**\n"
                    f"- This summary reflects the recorded transaction results. The run digest does not independently verify the source records."
                ), [r.record_id for r in c_records]

        # B. Largest Difference / Variance Query
        if any(w in q_lower for w in ["large", "largest", "biggest", "highest", "max", "maximum", "widest"]) and any(w in q_lower for w in ["difference", "diff", "variance", "gap", "delta"]):
            top_diffs = analytics["top_diff_txns"]
            if top_diffs:
                top = top_diffs[0]
                other_rows = []
                for idx, t in enumerate(top_diffs[1:4], 2):
                    other_rows.append(f"| **#{idx}** | `{t['id']}` | **₹{t['diff']:,.2f}** | {t['customer']} | {t['discrepancies'][0] if t['discrepancies'] else 'Variance'} |")
                
                table_md = "\n".join(other_rows)
                
                return (
                    f"### ðŸ” Transaction with the Largest Amount Difference\n\n"
                    f"The transaction with the largest variance in this batch is **`{top['id']}`** with an amount difference of **₹{top['diff']:,.2f}**.\n\n"
                    f"| Detail | Value |\n"
                    f"| :--- | :--- |\n"
                    f"| **Bank Transaction ID** | `{top['id']}` |\n"
                    f"| **Customer / Counterparty** | **{top['customer']}** |\n"
                    f"| **Bank Credit Received** | **₹{top['bank_amount']:,.2f}** |\n"
                    f"| **Expected Net Order Amount** | **₹{top['expected_net']:,.2f}** (Gross: ₹{top['gross_amount']:,.2f}) |\n"
                    f"| **Net Variance Gap** | <span style=\"color: #F87171; font-weight: 800;\">₹{top['diff']:,.2f}</span> |\n"
                    f"| **UTR Reference** | `{top['utr'] or 'Pending'}` |\n\n"
                    f"#### ðŸ’¡ Root Cause & Analysis\n"
                    f"{top['explanation'] or '; '.join(top['discrepancies'])}\n\n"
                    f"---\n"
                    f"#### ðŸ“Š Next Highest Variance Transactions:\n\n"
                    f"| Rank | Transaction ID | Variance Gap | Customer | Primary Reason |\n"
                    f"| :---: | :--- | :--- | :--- | :--- |\n"
                    f"{table_md}\n\n"
                    f"ðŸ‘‰ *You can inspect this transaction directly in the **Evidence Grid** or open **Discrepancy Queue** to review the journal adjustment.*"
                ), [top['id']]

        # C. Rounding variance queries report only observed record values.
        if any(word in q_lower for word in ["smallest", "minimum", "paisa"]) and any(word in q_lower for word in ["rounding", "variance", "difference", "delta"]):
            rounding_rows = analytics["rounding_txns"]
            if rounding_rows:
                item = rounding_rows[0]
                return (f"Smallest observed rounding-category difference: record `{item['id']}`, amount difference {item['diff']:.2f}. The source data does not establish the cause or accounting treatment."), [item["id"]]
            return ("No rounding-category records are available in this run."), []
        # D. Discrepancy category queries use counts computed for the current run.
        if any(word in q_lower for word in ["leakage", "fee leakage", "summarize the mdr", "timing lags", "refund", "clawback", "abnormal", "fee deduction gap", "excessive fee", "fee gap", "timing", "weekend", "delay", "t+1", "t+2", "clearing cycle"]):
            categories = summary.discrepancy_breakdown or {}
            rows = "\n".join(f"- {kind.replace('_', ' ')}: {count}" for kind, count in sorted(categories.items()))
            return (f"Discrepancy counts for run `{summary.run_id}`:\n\n{rows or 'No discrepancy counts available.'}"), []
        # G. Highest value records and exception ranking from current run data.
        if any(word in q_lower for word in ["highest value", "largest transaction", "biggest order", "largest deposit", "top transaction"]):
            top_b = analytics["top_bank_txns"]
            top_l = analytics["top_ledger_txns"]
            b_rows = "\n".join(f"| `{t['id']}` | {t['amount']:,.2f} | {t['customer']} |" for t in top_b[:3]) or "No bank records available."
            l_rows = "\n".join(f"| `{t['id']}` | {t['amount']:,.2f} | {t['customer']} |" for t in top_l[:3]) or "No ledger records available."
            return (f"Largest records in run `{summary.run_id}`:\n\nBank records (ID | amount | recorded counterparty):\n{b_rows}\n\nLedger records (ID | amount | recorded counterparty):\n{l_rows}"), [top_b[0]["id"]] if top_b else []

        # H. Exception ranking from current run data.
        if any(w in q_lower for w in ["unclaimed", "missing payout", "largest exception", "biggest orphan", "biggest missing", "uncollected"]):
            top_bo = analytics["top_bank_orphans"]
            top_lo = analytics["top_ledger_orphans"]
            lo_rows = "\n".join(f"| `{t['id']}` | {t['gross']:,.2f} | {t['customer']} | `{t['invoice']}` |" for t in top_lo[:3]) or "No ledger-side exceptions available."
            bo_rows = "\n".join(f"| `{t['id']}` | {t['amount']:,.2f} | `{t['utr']}` | {t['narration'][:30]} |" for t in top_bo[:3]) or "No bank-side exceptions available."
            linked_ids = [item["id"] for item in top_lo[:3] + top_bo[:3]]
            return (f"Exceptions in run `{summary.run_id}` (amounts are recorded source amounts; no recovery conclusion is implied):\n\nLedger-side:\n{lo_rows}\n\nBank-side:\n{bo_rows}"), linked_ids
        # I. Match Rate & Investigation Priorities
        if any(word in q_lower for word in ["below 80", "match rate", "investigate first", "why is match rate"]):
            return (
                f"### Reconciliation rates for run `{summary.run_id}`\n\n"
                f"Bank match rate: {summary.bank_match_rate * 100:.1f}% ({summary.bank_matched_records}/{summary.total_bank_records} bank records).\n\n"
                f"Ledger coverage: {summary.ledger_coverage_rate * 100:.1f}% ({summary.matched_ledger_records}/{summary.eligible_ledger_records} eligible ledger records).\n\n"
                f"Exceptions: {summary.exception_bank_count} bank-side and {summary.exception_ledger_count} ledger-side. Use the transaction list to inspect the affected records."
            ), []
        # J. Run digest and evaluation information
        if any(word in q_lower for word in ["merkle", "conformal", "crc", "cryptographic"]):
            evaluation = summary.evaluation
            precision = f"{evaluation.precision * 100:.1f}%" if evaluation and evaluation.precision_available else "Not available"
            digest = summary.merkle_root_hash or "Not available"
            return (
                f"### Run integrity information (`{summary.run_id}`)\n\n"
                f"Current score threshold: {summary.current_threshold if summary.current_threshold is not None else 'Not available'}\n\n"
                f"Observed evaluation precision: {precision}\n\n"
                f"Run result digest: `{digest}`\n\n"
                "The digest is internal to generated results. It does not attest to source completeness or provide external anchoring. The score threshold does not establish a statistical risk guarantee."
            ), []
        # L. Executive summary from current run data
        if any(word in q_lower for word in ["cfo", "headache", "urgent", "before 5", "screaming"]):
            return (
                f"Run `{summary.run_id}` contains {summary.total_bank_records} bank and {summary.total_ledger_records} ledger records. "
                f"There are {summary.exception_bank_count} bank-side and {summary.exception_ledger_count} ledger-side exceptions, "
                f"and {summary.matched_discrepancy_count} matched records with discrepancies. Inspect the current run data before taking accounting or recovery action."
            ), []
        # J. Specific Transaction Lookup (e.g. B004, BNK-1002, LEDG-005, UTR...)
        txn_match = re.search(r'\b(BNK-?\d+|LEDG-?\d+|TXN-?\d+|UTR\d+|INV\d+)\b', q_clean, re.IGNORECASE)
        if txn_match:
            target_id = txn_match.group(0).upper().replace("-", "")
            found = [r for r in results if target_id in (r.record_id.replace("-", "").upper() + (r.bank_record.utr_number.upper() if r.bank_record and r.bank_record.utr_number else "") + (r.matched_ledger_record.invoice_ref.upper() if r.matched_ledger_record and r.matched_ledger_record.invoice_ref else ""))]
            if found:
                r = found[0]
                disc_str = "; ".join([d.description for d in r.discrepancies]) if r.discrepancies else "None"
                l_str = f"Ledger `{r.matched_ledger_record.ledger_entry_id}` (Customer: {r.matched_ledger_record.counterparty_name})" if r.matched_ledger_record else "None (Orphan)"
                b_str = f"Bank `{r.bank_record.bank_txn_id}` (UTR: {r.bank_record.utr_number})" if r.bank_record else "None (Missing Payout)"
                
                return (
                    f"### ðŸ” Transaction Audit: `{r.record_id}`\n\n"
                    f"| Parameter | Value |\n"
                    f"| :--- | :--- |\n"
                    f"| **Record Status** | `{r.status.upper()}` |\n"
                    f"| **Candidate score** | **{(r.confidence_score * 100):.1f}%** |\n"
                    f"| **Bank Reference** | {b_str} |\n"
                    f"| **Ledger Reference** | {l_str} |\n"
                    f"| **Discrepancies Flagged** | {disc_str} |\n\n"
                    f"#### Audit Explanation:\n"
                    f"{r.explanation}"
                ), [r.record_id]

        # K. ERP export information
        if "tally" in q_lower or "xml" in q_lower or "journal voucher" in q_lower or "erp" in q_lower:
            return ("Use the run-level ERP Vouchers view to inspect balanced entries and items held for manual review. This assistant does not create or post ERP entries."), []
        # L. Dispute review information
        if "dispute" in q_lower or "npci" in q_lower or "chargeback" in q_lower or "claim" in q_lower:
            bank_orphans = [r for r in results if r.source_type == "bank" and r.status == "exception"]
            total_disputed = sum(float(r.bank_record.amount) for r in bank_orphans if r.bank_record)
            return (
                f"Run `{summary.run_id}` has {len(bank_orphans)} bank-side exception records totaling {total_disputed:,.2f} in recorded bank amounts. "
                "These are reconciliation exceptions only; no legal or regulatory claim is prepared by this response. Review source records and applicable procedures before filing."
            ), [r.record_id for r in bank_orphans[:5]]
        # M. Greeting and assistant identity
        if re.search(r'\b(hi|hello|hey|greetings|who are you)\b', q_lower):
            return (f"Hello. I can summarize recorded reconciliation data for run `{summary.run_id}`."), []
        # N. General Summary
        precision = summary.evaluation.precision if summary.evaluation and summary.evaluation.precision_available else None
        precision_text = f"{precision * 100:.1f}%" if precision is not None else "Not available"
        return (
            f"### Run summary: `{summary.run_id}`\n\n"
            f"Bank match rate: {summary.bank_matched_records}/{summary.total_bank_records} ({summary.bank_match_rate * 100:.1f}%).\n\n"
            f"Ledger coverage: {summary.matched_ledger_records}/{summary.eligible_ledger_records} eligible records ({summary.ledger_coverage_rate * 100:.1f}%).\n\n"
            f"Overall result resolution: {summary.resolved_result_records}/{summary.total_result_records} records ({summary.overall_resolution_rate * 100:.1f}%).\n\n"
            f"Observed evaluation precision: {precision_text}.\n\n"
            f"Matched clean: {summary.matched_clean_count}; matched with discrepancies: {summary.matched_discrepancy_count}; exceptions: {summary.exception_bank_count + summary.exception_ledger_count}."
        ), []
BankDisputeAgent = ReconciliationAssistant
