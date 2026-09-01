# ReconX — Multi-Source Autonomous Reconciliation Agent
> **Track 04: AI Finance Controller — Razorpay Buildathon 2026**

ReconX is an enterprise-grade agentic financial reconciliation system designed for payment intermediaries (Razorpay, nodal banks, and card/UPI networks). It ingests 2–3 tabular data sources, applies layered deterministic + LLM matching, classifies discrepancy root causes, detects reverse-sweep ledger orphans ("money expected but never received"), and provides an interactive evidence-intelligence dashboard with real-time threshold calibration and context-grounded AI assistant.

---

## 1. Key Highlights & Architectural Strengths

- **Deterministic First, LLM Only When Linguistic:** Exact matching (UTR, invoice references, order IDs, multi-signal scoring) is executed in pure, high-speed deterministic code ($O(1)$ indexed lookups). LLM calls are reserved strictly for parsing noisy/unstructured bank narrations and reasoning through genuinely ambiguous cases.
- **Strict One-to-One Claiming & Duplicate Protection:** Candidate claiming ensures no ledger entry is counted twice. A second claim on the same ledger row is automatically flagged as a duplicate conflict.
- **Bidirectional Reconciliation (Reverse Sweep):** Catches both bank-side unrepresented credits and critical ledger-side orphans ("money expected but never deposited in nodal account").
- **Phase C Batch Settlement (Many-to-One):** Automatically identifies when multiple ledger entries settle into a single consolidated bank credit.
- **Zero-Guess Policy & Honest Exception Registry:** The system never hallucinates or forces low-confidence matches. Unresolved items are logged with clear, auditable reasons.
- **Measured Accuracy Against Ground Truth:** Includes an evaluation harness that sweeps confidence thresholds against ground truth to empirically prove precision/recall trade-offs.

---

## 2. System Architecture

```
[Bank Statement CSV]  [Internal Ledger CSV]  [Network Settlement CSV (opt)]
        │                     │                       │
        └─────────────────────┼───────────────────────┘
                              ▼
           ┌─────────────────────────────────────┐
           │     ReconX Multi-Source Engine      │
           ├─────────────────────────────────────┤
           │ 1. Zero-Signal Triage Early Exit    │
           │ 2. UTR Exact Matcher                │
           │ 3. Narration Agent (Regex + LLM)    │
           │ 4. Fuzzy Matcher & Scoring Tool     │
           │ 5. Decision Maker (Triage/Ambiguity)│
           │ 6. Report Writer (Discrepancies)    │
           │ 7. Phase B: Reverse Sweep (Ledger)  │
           │ 8. Phase C: Batch-Settlement Check  │
           └──────────────────┬──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
           [Shared State & Trace]  [Evaluation Harness]
                    │                   │
                    ▼                   ▼
           [FastAPI Backend REST]  [Precision/Recall/Sweep]
                    │
                    ▼
           [Modern Dark-Themed React Evidence Dashboard]
```

### Components (3 Agents + 2 Deterministic Tools)
| Component | Type | Responsibility |
|---|---|---|
| **Decision Maker** | Agent (Fast Path + LLM) | Orchestrates the per-record forward flow, triages early exits, resolves ambiguity, and enforces zero-guessing. |
| **Narration Agent** | Agent (Regex + LLM) | Extracts remitter names, invoice references, and payment rail metadata from unstructured bank narration text. |
| **Report Writer** | Agent (Rule engine + explainer) | Identifies exact discrepancy root causes (fees, timing lags, partial refunds, rounding, batch settlement) and composes auditor-ready explanations. |
| **Matcher Tool** | Tool (Deterministic) | Indexes candidate pools and enforces 1-to-1 ledger row claiming. |
| **Scoring Tool** | Tool (Deterministic) | Multi-signal weighted confidence scoring (UTR 0.45, Ref 0.25, Name 0.15, Amount 0.10, Date 0.05). |

---

## 3. Quick Start & Execution

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Launch Everything (One Command)
```bash
python run_reconx.py
```

- **Backend API & Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Frontend Dashboard:** [http://localhost:5173](http://localhost:5173)

---

## 4. REST API Contract (Section 7 Compliant)

| Endpoint | Method | Purpose |
|---|---|---|
| `/upload` | POST | Accept CSV files or trigger synthetic batch generation |
| `/run/{run_id}` | POST | Execute reconciliation pipeline for a run |
| `/run/{run_id}/status` | GET | Live progress polling (`{status, processed, total, current_agent}`) |
| `/run/{run_id}/sources` | GET | Inspect loaded data sources and schema columns |
| `/run/{run_id}/transactions` | GET | Full transaction list with confidence scores and status |
| `/run/{run_id}/discrepancies` | GET | Filtered list of matched transactions with business variances |
| `/run/{run_id}/exceptions` | GET | Filtered list of bank-side and ledger-side orphan exceptions |
| `/run/{run_id}/transaction/{id}`| GET | Deep evidence intelligence trail for a single transaction |
| `/run/{run_id}/trace/{id}` | GET | Step-by-step multi-agent execution path |
| `/run/{run_id}/summary` | GET | Executive KPI summary and discrepancy breakdown |
| `/run/{run_id}/recompute` | POST | Instant re-thresholding without re-running LLM calls |
| `/run/{run_id}/threshold_sweep`| GET | Ground-truth precision/recall sweep data |
| `/chat` | POST | Grounded AI Financial Controller assistant queries |
| `/run/{run_id}/report` | GET | In-page rendered audit report |
| `/run/{run_id}/report/download`| GET | Download audit report on demand (CSV / JSON) |

---

## 5. Automated Tests
To run the automated test suite:
```bash
python -m pytest backend/tests/ -v
```
