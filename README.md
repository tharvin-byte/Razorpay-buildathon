<p align="center">
  <img src="docs/images/banner.jpg" alt="ReconX Banner" width="100%"/>
</p>

<p align="center">
  <strong>Multi-Source Autonomous Financial Reconciliation & Exception Intelligence</strong>
</p>

<p align="center">
  <a href="https://razorpay-buildathon-frontend-3z5m.onrender.com"><img src="https://img.shields.io/badge/🚀_Live_Demo-10B981?style=for-the-badge" alt="Live Demo"/></a>
  <a href="https://razorpay-buildathon-6zzj.onrender.com/docs"><img src="https://img.shields.io/badge/📖_API_Docs_(Swagger)-0288D1?style=for-the-badge" alt="API Docs"/></a>
  <a href="https://youtu.be/lrncP_iNwpM?si=mMvm-FgduKV0cY1K"><img src="https://img.shields.io/badge/▶_YouTube_Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="YouTube"/></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Vite_6-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Gemini_2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="MIT"/>
</p>

<p align="center"><em>Built for <strong>Track 04: AI Finance Controller</strong> — Razorpay Buildathon 2026</em></p>

---

ReconX is an in-memory reconciliation demo for bank, ledger, and settlement data. It scores candidate matches, reports discrepancies, and abstains when available evidence is insufficient. Synthetic demo runs are enabled; CSV uploads remain disabled until authenticated access is configured. Run results are not accounting approval, regulatory filings, or auditor attestation.

The backend can use the optional Gemini integration for assistant responses. Authentication and production financial-data handling are not configured. Do not use this demo with live financial data.

---

## 🌐 Live Deployment

| Service | URL | Status |
|:---|:---|:---:|
| **Frontend Dashboard** | [razorpay-buildathon-frontend-3z5m.onrender.com](https://razorpay-buildathon-frontend-3z5m.onrender.com) | 🟢 Live |
| **Backend API** | [razorpay-buildathon-6zzj.onrender.com](https://razorpay-buildathon-6zzj.onrender.com) | 🟢 Live |
| **Swagger API Docs** | [razorpay-buildathon-6zzj.onrender.com/docs](https://razorpay-buildathon-6zzj.onrender.com/docs) | 🟢 Live |

> **Note:** Free-tier backend may take 30–50s to wake up after inactivity. This is a Render hosting constraint, not a performance issue.

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="docs/images/dashboard.png" alt="Executive Dashboard" width="100%"/>
      <br/><strong>Executive Dashboard</strong><br/>
      <sub>Real-time KPIs, match rates, and Merkle attestation status</sub>
    </td>
    <td align="center" width="50%">
      <img src="docs/images/nodal_flow.png" alt="Nodal Escrow Flow" width="100%"/>
      <br/><strong>Nodal Escrow Flow</strong><br/>
      <sub>Illustrative transaction flow from available run fields</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="docs/images/agent_trace.png" alt="Agent Trace Explorer" width="100%"/>
      <br/><strong>Agent Trace Explorer</strong><br/>
      <sub>Step-by-step reasoning trail for every reconciliation decision</sub>
    </td>
    <td align="center" width="50%">
      <img src="docs/images/erp_vouchers.png" alt="ERP Voucher Generation" width="100%"/>
      <br/><strong>ERP Voucher Generation</strong><br/>
      <sub>Auto-generated double-entry Tally XML & Zoho JSON vouchers</sub>
    </td>
  </tr>
</table>

---

## Benchmarks

No independently verified benchmark report is maintained in this repository. Use the bundled synthetic fixtures and tests to measure behavior in your environment.


## 🤖 The 4 Agent Pipeline

| # | Agent | Responsibility |
|:---:|:---|:---|
| 1 | **Planner Agent** | Ingests and normalizes multi-format CSVs. Builds `O(1)` inverted index trees across UTRs, Order IDs, and timestamps for sub-millisecond lookups. |
| 2 | **NarrationParser Agent** | Extracts structured tokens (UPI handles, IMPS codes, POS terminal IDs, MDR tags) from unstructured Indian bank narration strings using regex + subword tokenization. |
| 3 | **DecisionMaker Agent** | Runs 5-channel orthogonal scoring. Resolves 1:1 matches with a linear-claim mutex. Routes low-confidence pairs (Δ < 0.08) to quarantine instead of guessing. |
| 4 | **Discrepancy Agent** | Summarizes observed field differences and run results. Unexplained differences are held for review. |

---

## ✨ Key Features

### Core Reconciliation Engine
- **Flexible Multi-Source Ingestion** — Operates on any 2-of-3 sources (bilateral) or full 3-way triangulation
- **O(1) Fast-Path Matching** — Inverted hash index for clean UTR/invoice lookups before fuzzy fallback
- **5-Channel Orthogonal Scoring** — Weighted signal combination across reference IDs, narrations, amounts, and timestamps
- **Abstention on Ambiguity** — Records with confidence gap < 8% between top-2 candidates are quarantined, not force-matched
- **Labeled Evaluation** - Reports empirical metrics when bundled ground-truth labels are available; this does not establish a statistical risk guarantee

### Enterprise Outputs
- **ERP Voucher Export** - Exports supported balanced entries to Tally XML; unsupported accounting treatments are held for manual review
- **Discrepancy Review** - Displays source-record exceptions for human investigation; it does not prepare legal claims
- **Transaction Flow View** - Visualizes available records and derived fields; it does not establish regulatory compliance
- **Run Result Digest** - Provides an internal SHA-256 digest of run results, without external anchoring
- **Run Report** - Exports computed reconciliation counts and observed metrics

### Intelligence & Operations
- **15-View Enterprise Dashboard** — React 19 + Vite with Framer Motion animations
- **Natural Language Financial Copilot** — Gemini 2.5 Flash-powered query assistant (with rule-based fallback)
- **Threshold Playground** - Recomputes decisions at selected thresholds; labeled precision/recall appears only when available
- **Agent Trace Explorer** - Displays recorded processing trace steps when present
- **Scenario Views** — Displays run-derived scenario information where available; no synthetic financial outcomes are presented as live results

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### Option A: One-Click Launch

```bash
git clone https://github.com/tharvin-byte/Razorpay-buildathon.git reconx
cd reconx
pip install -r requirements.txt
python run_reconx.py
```

### Option B: Separate Terminals

```bash
# Terminal 1 — FastAPI Backend
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
# Terminal 2 — React Frontend
cd frontend && npm install && npm run dev
```

| | URL |
|:---|:---|
| **Dashboard** | http://localhost:5173 |
| **API Docs** | http://127.0.0.1:8000/docs |

### Optional: Gemini Copilot

```bash
# Copy .env.example → .env and add your key
GEMINI_API_KEY=your_key_here
```

When configured, the Financial Copilot uses `gemini-2.5-flash` for natural language treasury queries. Without a key, it falls back to a deterministic rule-based assistant automatically.

### Running Tests

```bash
python -m pytest backend/tests/ -v   # 68 tests across 10 test files
```

The platform bootstraps a demo run (`demo-run-001`) on startup with 70 bank records, 100 ledger entries, and embedded ground truth.

---

## 📁 Project Structure

```text
reconx/
├── backend/
│   ├── main.py                           # FastAPI app, in-memory run store, API routes
│   ├── models/
│   │   └── schemas.py                    # Pydantic v2 schemas for all inputs & outputs
│   └── engine/
│       ├── orchestrator.py               # Multi-phase pipeline orchestrator
│       ├── matcher.py                    # O(1) inverted index, reverse sweep, batch settlement
│       ├── scorer.py                     # 5-channel orthogonal scoring engine
│       ├── data_generator.py             # Synthetic data generator with ground truth labels
│       ├── audit_exporter.py             # SHA-256 Merkle tree, evaluation harness
│       ├── vector_tensor.py              # [Research] 3D tensor core & Sinkhorn OT
│       ├── graph_solver.py               # [Research] Bipartite graph partitioning & DAGs
│       ├── conformal_verifier.py         # Conformal risk control & Merkle audit tree
│       └── agents/
│           ├── decision_maker_agent.py   # Autonomous 1:1 mutex decision maker
│           ├── narration_parser_agent.py  # Regex + semantic token extractor
│           ├── discrepancy_agent.py      # MDR (2%) + GST (18%) forensic decomposition
│           ├── erp_voucher_agent.py      # Double-entry vouchers (Tally XML / Zoho JSON)
│           ├── bank_dispute_agent.py     # Statutory dispute letters (NPCI Form-1)
│           └── assistant_agent.py        # RAG Financial Copilot (Gemini + fallback)
├── frontend/                              # React 19 + Vite — 15 dashboard views
├── backend/tests/                         # 22 test suites (matching, scoring, API, tensors)
├── render.yaml                            # Render.com deployment blueprint
├── run_reconx.py                          # One-click dual-server launcher
└── requirements.txt                       # Python dependencies
```

---

## 🔌 API Reference

| Endpoint | Method | Description |
|:---|:---:|:---|
| `/upload` | `POST` | Generate synthetic demo data. CSV uploads return 503 until authenticated access is configured. |
| `/run/{run_id}` | `POST` | Trigger the reconciliation pipeline |
| `/run/{run_id}/status` | `GET` | Real-time progress: agent stage, processed count |
| `/run/{run_id}/summary` | `GET` | Run counts, explicitly denominated rates, and internal result digest. |
| `/run/{run_id}/transactions` | `GET` | Filtered transaction list with confidence scores |
| `/run/{run_id}/transaction/{id}` | `GET` | Single-transaction forensic trace |
| `/run/{run_id}/discrepancies` | `GET` | MDR fee splits, GST deductions, timing lags |
| `/run/{run_id}/exceptions` | `GET` | Bank orphans and ledger orphans |
| `/run/{run_id}/erp-vouchers` | `GET` | Auto-generated double-entry accounting vouchers |
| `/run/{run_id}/disputes` | `GET` | Legacy endpoint for generated dispute records; not a validated regulatory filing. |
| `/run/{run_id}/statutory-dossier` | `GET` | Legacy route returning a reconciliation run report. |
| `/run/{run_id}/recompute` | `POST` | Recompute threshold without re-running pipeline |
| `/run/{run_id}/threshold_sweep` | `GET` | Precision/recall sweep across confidence thresholds |
| `/chat` | `POST` | Natural language Financial Copilot query |

> Full interactive documentation: [`/docs`](https://razorpay-buildathon-6zzj.onrender.com/docs) (Swagger UI)

---

## 🧠 Design Decisions

### Why Not Use LLMs for Matching?

Three constraints make cloud LLM approaches unsuitable for Indian fintech reconciliation:

| Constraint | Impact |
|:---|:---|
| **Regulatory** | This repository does not implement a regulatory compliance assessment. |
| **Accounting Semantics** | Double-entry bookkeeping requires discrete binary decisions. Probabilistic soft scores from LLMs are incompatible with general ledger posting rules. |
| **Scale & Cost** | At NPCI-scale volumes (billions of monthly UPI transactions), per-token LLM costs and 1–3s inference latency are operationally unviable. |

### Production vs. Research Suite

| | Production Pipeline | Research Suite |
|:---|:---|:---|
| **Files** | `matcher.py`, `scorer.py`, `orchestrator.py` | `vector_tensor.py`, `graph_solver.py` |
| **Complexity** | O(1) inverted index | O(M×N) dense tensor |
| **Memory (10k rows)** | < 10 MB | ~4 GB |
| **Output** | Discrete 1:1 match or quarantine | Continuous probability distribution |
| **ERP Compatibility** | Direct journal voucher posting | Incompatible with discrete ledger entries |

The Sinkhorn OT solver and bipartite graph engine are maintained as an **offline research harness** to benchmark theoretical assignment bounds, not as a live request-path component.

### Abstention Safety

In financial auditing, a **false positive match is far more harmful** than an unreconciled item:

```
If S₁ ≥ τ  AND  (S₁ - S₂) < 0.08  AND  S₂ > 0.65  →  Quarantine
```

Records are routed to an AML Suspense Registry for human controller review rather than forcing a guess.

### Conformal Risk Control Scope

Conformal calibration (Angelopoulos et al., Stanford/UC Berkeley) is applied **only when labelled ground truth exists** — specifically against the synthetic benchmark. On real-world unlabelled uploads, the engine marks calibration as `None` and does not self-generate circular labels. This is an intentional design boundary.

---

## 🗺 Roadmap

| Phase | Target |
|:---|:---|
| **Phase 1** *(current)* | End-to-end matching pipeline, 4 agents, 15 React views, Merkle sealing, research tensor suite, cloud deployment |
| **Phase 2** | PostgreSQL/TimescaleDB persistence, Apache Kafka streaming ingestion |
| **Phase 3** | Redis distributed lock (`Redlock`) for horizontal multi-worker scaling |
| **Phase 4** | Direct SFTP/REST connectors for HDFC/ICICI host-to-host nodal feeds; SAP OData posting |

---

## ⚙️ Engineering Notes

- **In-Memory Store** — Run sessions are held in a Python dict (`RUNS` in `main.py`). Data does not persist across restarts; a database adapter is the Phase 2 priority.
- **Data Residency** — Core matching, decomposition, and Merkle hashing execute entirely on-process with no network egress of financial records.
- **Simulation Sandbox** — The frontend includes 6 pre-configured treasury edge-case scenarios accessible from the Scenarios view.
- **Free-Tier Deployment** — The live demo runs on Render's free tier. Backend sleeps after 15 min of inactivity (~30–50s cold start).

---

<p align="center">
  <strong>Developed for Track 04: AI Finance Controller — <a href="https://razorpay.com">Razorpay</a> Buildathon 2026</strong>
  <br/>
  Licensed under the <a href="LICENSE">MIT License</a>
</p>
