# ReconX — Multi-Source Reconciliation Agent
## Technical Design Document
**Track 04: AI Finance Controller — Razorpay Buildathon 2026**

---

## 1. Problem Statement

### 1.1 The official ask
Build an agent that closes one finance-ops loop across a 50+ record batch of synthetic data, reporting its match rate and the exceptions it could not resolve. The bar: throughput + measured accuracy + an honest exception list. One cherry-picked match proves nothing.

### 1.2 The real-world problem being modeled
A payments company like Razorpay sits between merchants, banks, and payment networks. For every transaction, at least three independent systems record their own version of what happened:

1. **The bank** — records what actually moved through the nodal/escrow account.
2. **Razorpay's internal ledger** — records what Razorpay's own system believes happened (order captured, fee applied, settlement expected).
3. **The payment network / settlement report** — records what the card network or UPI (NPCI) settled, in its own batch cycle.

These three records *should* describe the same transaction identically. In practice they frequently don't, because of real, legitimate business causes — not because anything is "broken." Today, reconciling these records is done manually by finance analysts, which is slow, error-prone, and does not scale with transaction volume.

### 1.3 Why this matters (the business case)
- **Direct financial loss risk** — unreconciled fee/amount gaps, at scale, represent real, uncaught money.
- **Regulatory/audit requirement** — RBI-regulated payments companies must demonstrate a clean, auditable trail of every rupee.
- **Merchant trust** — merchants dispute settlement mismatches; fast, accurate reconciliation is a retention factor.
- **Fraud/error detection** — some discrepancies are not noise; they can indicate real errors or fraud.
- **Operational cost** — manual reconciliation does not scale linearly with transaction volume; this is explicitly called out as the reason the track exists ("reconciliation... still done by hand").

### 1.4 Root causes of real discrepancies (what the system must recognize)
1. **Fee deduction** — network fee + platform fee taken before settlement; ledger shows gross, bank shows net.
2. **Settlement timing lag** — T+1/T+2/T+3 batch cycles; same transaction, different recorded dates.
3. **Batch settlement (many-to-one)** — multiple ledger entries settle as a single lump bank credit.
4. **Failed/reversed transactions** — ledger shows captured, bank shows nothing or a reversal.
5. **Reference number formatting differences** — same transaction, differently formatted IDs across systems.
6. **Duplicate submissions/retries** — a failed attempt followed by a retry can appear as two records.
7. **Currency/rounding differences** — small, legitimate paisa-level gaps.
8. **Partial refunds** — net settlement reduced by a recorded refund amount.

---

## 2. Solution Overview

ReconX is an agentic reconciliation system that ingests 2–3 tabular data sources (bank statement, internal ledger, optional network settlement report), matches records across them using a layered deterministic + LLM approach, explains every discrepancy in plain language, and honestly reports what it could not resolve — rather than forcing or hiding uncertain matches.

### 2.1 Design principles
- **Deterministic first, LLM only where genuinely needed.** Exact/fuzzy matching and scoring are plain code — fast, free, and fully explainable. LLM calls are reserved for two tasks that require language understanding: parsing unstructured bank narration text, and reasoning through genuinely ambiguous cases.
- **Never guess.** When evidence is insufficient or conflicting, the system marks the record as an honest exception with a stated reason, rather than forcing a low-confidence match.
- **Bidirectional checking.** The system checks both directions — every bank record against the ledger, and every ledger record against the bank statement — so that "money expected but never received" (a ledger-side orphan) is caught, not just bank-side mismatches.
- **Source-count agnostic.** The architecture works identically whether given 2 sources (bank + ledger) or 3 (+ network settlement); the Matcher simply searches however many candidate tables are provided.

---

## 3. Data Layer

### 3.1 Sources

**Source 1 — Bank Statement** (received as periodic SFTP/batch file exports; CSV/MT940-style; ~100% UTR presence)

| Field | Type | Example |
|---|---|---|
| bank_txn_id | string | BNK-20260303-8891 |
| date | date | 2026-03-03 |
| amount | float | 4980.00 |
| type | enum | credit / debit |
| counterparty_account | string (masked) | XXXXXX1234 |
| narration | string | NEFT-CR-HDFC0001234-RAMESHKUMAR-INV2201 |
| utr_number | string | UTR20260303556677 |

**Source 2 — Internal Ledger** (native DB/API, fully structured; ~60–70% UTR presence)

| Field | Type | Example |
|---|---|---|
| ledger_entry_id | string | LEDG-000123 |
| order_id | string | order_MnO9x7QzT |
| merchant_id | string | merchant_88213 |
| expected_settlement_date | date | 2026-03-03 |
| gross_amount | float | 5000.00 |
| razorpay_fee | float | 20.00 |
| refund_amount | float | 0.00 |
| counterparty_name | string | Ramesh Kumar |
| invoice_ref | string | INV2201 |
| status | enum | pending / settled / failed |

**Source 3 — Network Settlement Report** (optional; SFTP batch file, network-specific schema; ~50–60% UTR presence)

| Field | Type | Example |
|---|---|---|
| network_settlement_id | string | NPCI-SET-99881 |
| settlement_batch_date | date | 2026-03-04 |
| payment_method | enum | UPI / card / netbanking |
| gross_amount | float | 5000.00 |
| network_fee | float | 20.00 |
| net_amount | float | 4980.00 |
| merchant_order_ref | string | INV2201 |

**Ground Truth** — a hidden mapping file (bank_id ↔ ledger_id ↔ settlement_id, or explicit "no match"), generated alongside the synthetic data, used only by the evaluation harness — never exposed to the agents.

### 3.2 Synthetic data composition (per batch of 60–80 bank records)
- ~70% clean matches (UTR present, resolves trivially)
- ~15% matched-with-discrepancy (fee, timing, refund, batch)
- ~10% deliberately missing UTR (forces narration-parsing fallback)
- ~5% genuine orphans (true exceptions, both bank-side and ledger-side)

### 3.3 Narration field
The narration field is the one genuinely unstructured column in the dataset — a bank-generated free-text string following per-rail templates (NEFT/UPI/IMPS), e.g. `UPI/RAMESHKUMAR/9876543210/INV2201`. Real-world narration formats vary across banks and drift over time; the synthetic dataset uses a small set of consistent per-rail templates to make the majority of cases solvable by pattern matching, while intentionally including a subset of malformed/truncated narrations to exercise the LLM fallback path.

---

## 4. Agent Architecture

### 4.1 Final agent count: 3 agents + 2 shared tools

| # | Component | Type | Role |
|---|---|---|---|
| 1 | **Decision Maker** | Agent (rule-based fast path + LLM fallback) | Orchestrates the per-record flow; decides what to check next; makes the final call — confident match or honest exception. Never guesses. |
| 2 | **Narration Agent** (Text Reader) | Agent (regex primary + LLM fallback) | Extracts name/reference from messy bank narration text, only when reference fields are missing. |
| 3 | **Report Writer** (Discrepancy Finder) | Agent (rule checks + LLM phrasing) | The core value-delivering agent. For matched pairs, identifies *why* they differ (fee/timing/refund/duplicate) or flags an unexplained gap honestly. For unresolved records, writes a clear reason. |
| — | **Matcher** | Tool (deterministic) | Exact match on UTR/invoice_ref first; fuzzy name/amount/date fallback. Enforces one-to-one claiming (no ledger row matched twice). Shared by both the reference-lookup path and the narration-extraction path. |
| — | **Scoring Tool** | Tool (deterministic) | Combines all available signals into one weighted confidence score. |

### 4.2 Why this count (design rationale)
The original design considered 8 separate components (Planner, Reference Lookup, Narration Parser, Fuzzy Matcher, Scoring Tool, Verifier, Discrepancy Classifier, Exception Handler). On review:
- **Planner + Verifier** do the same fundamental job — reasoning about evidence and deciding next steps — and were merged into the **Decision Maker**.
- **Reference Lookup + Fuzzy Matcher** both do "find candidate matches," just with different strategies (exact vs. fuzzy) — merged into the **Matcher** tool.
- **Discrepancy Classifier + Exception Handler** both do "explain the outcome," just for two different outcomes (matched-with-a-reason vs. unresolved-with-a-reason) — merged into the **Report Writer**.
- **Fuzzy Matcher and Scoring Tool are explicitly *not* discrepancy-finders.** A name formatting difference ("RAMESHKUMAR" vs "Ramesh Kumar") is not a real-world problem — it is a normalization step the Matcher handles silently before deciding whether two rows represent the same transaction. Only the Report Writer identifies and reports genuine, money-relevant discrepancies.

### 4.3 Scoring weights

| Signal | Weight |
|---|---|
| UTR / exact reference match | 0.45 |
| Invoice ref / order ID match | 0.25 |
| Counterparty name similarity | 0.15 |
| Amount match (fee-tolerant) | 0.10 |
| Date proximity (settlement window) | 0.05 |

Constants: `CONFIDENCE_THRESHOLD = 0.75` (validated via threshold sweep against ground truth — see 4.6), `ROUNDING_TOLERANCE = ₹1.00`, `SETTLEMENT_WINDOW_DAYS = 3`.

### 4.4 Processing phases

**Phase A — Forward pass (per bank record).**
```
Decision Maker checks: zero-signal early exit (no UTR, no narration) → exception immediately
  → has UTR? → Matcher (exact) → high score → Report Writer → resolved, claim ledger row
  → no UTR? → Narration Agent (regex → LLM fallback) → extracted name/ref
              → Matcher (exact retry + fuzzy) → Scoring Tool
                   → clear high score → Report Writer → resolved, claim ledger row
                   → ambiguous (close scores) → Decision Maker's LLM reasoning step
                        → resolves → Report Writer
                        → cannot resolve → Report Writer (exception path)
```

**Phase B — Reverse sweep (once, after Phase A completes).**
Every ledger row never claimed by a bank record is checked: if `status = failed`, it is correctly recognized as an expected non-match (not a problem); otherwise it is flagged as a genuine exception — "money expected but never received." This catches the case a bank-driven pass alone would miss entirely.

**Phase C — Batch-settlement check (only on still-unmatched bank records).**
Tests whether one unmatched bank amount equals the sum of 2–3 unclaimed ledger rows (many-to-one settlement), a lightweight, bounded check rather than a full combinatorial search.

**Phase D — Threshold validation (once, during development).**
Sweeps `CONFIDENCE_THRESHOLD` across a small range (0.6–0.85) against the hidden ground truth, reporting precision/recall at each value; the deployed threshold is the empirically best trade-off, not a guessed constant.

### 4.5 Hardening rules
- Every LLM call wrapped in a safe-parse/retry/fallback — a malformed model response degrades to "low confidence / needs review" rather than crashing the pipeline mid-batch.
- One-to-one enforcement — once a ledger row is claimed, it is removed from the candidate pool; a second bank record's only remaining strong candidate being already-claimed is itself flagged as a possible duplicate/retry.
- Explicit, named tolerance constants (not ad hoc buffers).
- Partial-refund-aware amount check (`net_expected = gross − fee − refund`).

### 4.6 Known, stated scope boundaries
- Batch-settlement detection (Phase C) is a bounded heuristic (checks groups of 2–3), not an exhaustive combinatorial solver — acceptable for the given data scale, explicitly disclosed as a scope choice.
- Full N:1 matching across more complex settlement batches is a natural extension, out of scope for the initial build.

### 4.7 Why an LLM is not used for the core matching/scoring math
Matching and scoring are precise, verifiable operations (exact equality, arithmetic, weighted sums) — well-suited to deterministic code, which is faster, free, and fully explainable ("why did this match?" → "here is the exact score breakdown," not "the model decided"). An LLM is used only where the task is genuinely linguistic: parsing inconsistent free-text narration, and composing clear natural-language explanations grounded in already-computed facts. A trained ML classifier (e.g., XGBoost) was considered and deliberately not used, since the matching logic is already well-defined by domain rules rather than something requiring statistical pattern discovery from historical labels.

---

## 5. Evaluation

After a full run, an evaluation harness compares the system's output against the hidden ground truth to compute:
- **Match rate** (matched / total)
- **Precision** — of everything marked "matched," how many are actually correct (catches false positives, e.g. two transactions sharing the same amount/date but not being the same transaction)
- **Recall** — of everything that should have matched, how many were found
- **False positive rate** — specifically on the same-amount/different-transaction trap
- **Exception accuracy** — whether true orphans were correctly flagged rather than force-matched

---

## 6. Shared State & Chatbot

Every processed record's full result (status, matched counterpart, confidence score, evidence trail, Report Writer's explanation) is written to one shared state object after the pipeline run. A chatbot agent receives the entire state as context per question (feasible at this data scale — 50–100 records fit comfortably in a single prompt, no retrieval system required) and answers strictly from what is already computed and stored — it does not re-reason about matches independently.

---

## 7. Backend API Contract

| Endpoint | Method | Purpose |
|---|---|---|
| `/upload` | POST | Accept CSV files, return `run_id` |
| `/run/{run_id}` | POST | Start the pipeline for this run |
| `/run/{run_id}/status` | GET | Poll for live progress: `{status, processed, total, current_agent, current_record}` |
| `/run/{run_id}/sources` | GET | Which files were loaded, row counts |
| `/run/{run_id}/transactions` | GET | Full results list (all statuses) |
| `/run/{run_id}/discrepancies` | GET | Pre-filtered: matched_with_discrepancy |
| `/run/{run_id}/exceptions` | GET | Pre-filtered: exception (bank-side + ledger-side, with `side` and `reason`) |
| `/run/{run_id}/transaction/{txn_id}` | GET | One record's full evidence trail |
| `/run/{run_id}/trace/{txn_id}` | GET | Step-by-step agent path for one record (for live-trace demo view) |
| `/run/{run_id}/summary` | GET | KPI counts + discrepancy breakdown |
| `/run/{run_id}/recompute` | POST | Re-apply threshold to already-scored data (no LLM re-call); query param `threshold` |
| `/chat` | POST | `{run_id, question}` → `{answer}`, grounded in shared state |
| `/run/{run_id}/report` | GET | Formatted report for in-page display |
| `/run/{run_id}/report/download` | GET | Generates file on demand; query param `format=pdf\|csv` |

Design rule: nothing auto-downloads. Every page displays data fetched via GET; the report page renders in-page by default and only produces a file on explicit "Download" click.

---

## 8. Frontend Structure

Visual language: dark theme (near-black background, card panels one shade lighter, 1px borders, 8–10px radius), blue→purple gradient for confidence/progress elements, green/amber/coral for resolved/flagged/exception states, monospace type for IDs and formulas — modeled on the Veloquity (AWS AIdeas finalist) evidence-intelligence UI pattern.

**Sidebar navigation (grouped):**

```
DATA INGESTION
  Upload & Run        → POST /upload, POST /run/{id}, GET /run/{id}/status (polled)
  Data Sources        → GET /run/{id}/sources

EVIDENCE & MATCHING
  Transactions         → GET /run/{id}/transactions
  Confidence Scores     → GET /run/{id}/transactions (score fields) + /transaction/{txn_id} for full breakdown
  Evidence Trail         → GET /run/{id}/transaction/{txn_id}

DECISION OUTCOMES
  Discrepancies        → GET /run/{id}/discrepancies
  Exceptions            → GET /run/{id}/exceptions
  Threshold Playground   → GET /run/{id}/summary, POST /run/{id}/recompute (on slider change, debounced)

INTELLIGENCE ENGINE
  Agents                → static architecture diagram + GET /run/{id}/status (current_agent) + GET /run/{id}/trace/{txn_id}
  Assistant              → POST /chat

REPORTS
  Export                 → GET /run/{id}/report (display), GET /run/{id}/report/download (on click only)
```

Efficiency note: since the dataset is small, `/transactions` can return full evidence-trail data inline for every record, letting Transactions, Confidence Scores, Discrepancies, and Exceptions all share a single fetch on run load, filtering client-side.

---

## 9. Tech Stack

- **Orchestration:** LangGraph (Planner/Decision-Maker as the hub node with conditional routing; ReAct-style loop for ambiguous cases)
- **LLM:** Gemini (free tier) — used only for narration-parsing fallback, ambiguous-case reasoning, and explanation phrasing
- **Matching/scoring:** Python + pandas
- **Fuzzy string matching:** rapidfuzz
- **Backend:** FastAPI
- **Evaluation:** custom script comparing pipeline output to hidden ground truth, including a threshold-sweep utility
- **Demo UI:** left to implementation environment (React/Tailwind or equivalent), consuming the API contract in Section 7

---

## 10. Why This Design Is Defensible

- **Dynamic, per-record agentic reasoning** — different records take different paths through the system (1-step resolution for clean UTR matches, multi-step for ambiguous narration cases) rather than a fixed linear pipeline.
- **Every decision traceable to a tool call** — no hallucinated matches; the LLM never performs arithmetic or exact comparison itself.
- **Explicit honesty mechanism** — the Decision Maker and Report Writer are designed to abstain rather than guess, directly satisfying the "honest exception list" requirement.
- **Bidirectional correctness** — catches both "bank has something ledger doesn't" and "ledger expects something bank never delivered."
- **Real, named discrepancy causes** — grounded in actual payments-industry reconciliation practice, not invented complexity.
- **Measured, not claimed, accuracy** — evaluated against self-generated ground truth with a validated (not guessed) confidence threshold.
- **Source-count agnostic** — works with 2 or 3 input sources without redesign.
