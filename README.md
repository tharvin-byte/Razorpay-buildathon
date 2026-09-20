# ReconX — Multi-Source Financial Reconciliation Intelligence

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-4CAF50?style=for-the-badge)](https://razorpay-buildathon-frontend-3z5m.onrender.com)
[![API Docs](https://img.shields.io/badge/📖_API_Docs-0288D1?style=for-the-badge)](https://razorpay-buildathon-6zzj.onrender.com/docs)
[![Watch Demo](https://img.shields.io/badge/▶_YouTube_Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/lrncP_iNwpM?si=mMvm-FgduKV0cY1K)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

> **Built for Track 04: AI Finance Controller — Razorpay Buildathon 2026**

ReconX is an autonomous, multi-agent financial reconciliation platform that matches and explains discrepancies across three enterprise data sources: **Nodal Bank Statements**, **Internal ERP Ledgers**, and **Payment Gateway Settlement feeds**. It is designed to operate without external LLM APIs, using a deterministic rule-based engine grounded in published mathematical research — making it suitable for regulated Indian financial environments.

---

## 🌐 Live Deployment

| Service | URL |
|:---|:---|
| **Frontend Dashboard** | https://razorpay-buildathon-frontend-3z5m.onrender.com |
| **Backend REST API** | https://razorpay-buildathon-6zzj.onrender.com |
| **Interactive API Docs** | https://razorpay-buildathon-6zzj.onrender.com/docs |

> **Note:** The free-tier backend may take 30–50 seconds to wake up on first request after a period of inactivity. This is a Render free-tier characteristic, not an application issue.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Benchmark Metrics](#benchmark-metrics)
- [Quick Start (Local)](#quick-start-local)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Design Decisions](#design-decisions)
- [Roadmap](#roadmap)
- [Engineering Notes](#engineering-notes)

---

## Overview

Indian enterprises reconciling high-volume payment flows face three compounding challenges:

1. **Regulatory constraints:** RBI Nodal Escrow directives and the DPDP Act 2023 restrict sending raw transaction PII to external cloud AI APIs.
2. **Data complexity:** Indian bank narrations are noisy, truncated, and inconsistently formatted across institutions, making rule-free matching unreliable.
3. **Scale:** At NPCI-level volumes (billions of monthly UPI transactions), probabilistic AI inference latency and per-token API costs are operationally unviable.

ReconX addresses these constraints by implementing a **deterministic, neuro-symbolic 4-agent pipeline** that runs fully on-premise, with no external model dependencies.

---

## Architecture

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────────┐
│ Nodal Bank Feed │       │ ERP Ledger Feed │       │ Gateway Settlements │
└────────┬────────┘       └────────┬────────┘       └──────────┬──────────┘
         └─────────────────┬───────┴───────────────────────────┘
                           │
                 [ Planner Agent ]
                 Inverted Index O(1) — UTR & Invoice Hash Lookup
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
     [ Exact Match ]            [ Fuzzy / Discrepancy ]
     Score = 1.0                NarrationParserAgent
                                (Regex + Subword Tokenizer)
                                5-Channel Orthogonal Scoring:
                                • Exact UTR Hash        (w=0.45)
                                • Invoice / Order Ref   (w=0.25)
                                • Counterparty Fuzzy    (w=0.15)
                                • Amount & MDR Kernel   (w=0.10)
                                • Date Proximity Decay  (w=0.05)
                                         │
             └─────────────┬─────────────┘
                           │
           [ DecisionMaker Agent ]
           Conflict Detector & Abstention Filter (Δ < 0.08)
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    [ Matched / Discrepancy ]       [ Quarantined Exception ]
    DiscrepancyAgent                AML Suspense Registry
    (MDR Fee & 18% GST Split)       (Manual Controller Review)
             │                                  │
             ▼                                  ▼
    [ ERPVoucherAgent ]             [ BankDisputeAgent ]
    Tally XML / Zoho JSON           NPCI Form-1 (PSS Act 2007 §10)
             │                                  │
             └─────────────┬────────────────────┘
                           │
            [ SHA-256 Merkle Audit Tree ]
            Tamper-Evident Attestation Root (64-hex)
```

### The 4 Agents

| Agent | Role |
|:---|:---|
| **Planner Agent** | Ingests and normalizes multi-format CSVs; builds `O(1)` inverted index trees across UTRs, Order IDs, and timestamps |
| **Narration Parser Agent** | Extracts structured tokens (UPI handles, IMPS codes, POS IDs, MDR tags) from unstructured Indian bank narration strings |
| **Matcher / DecisionMaker Agent** | Runs 5-channel orthogonal scoring; resolves 1:1 matches, N:1 batch netting, and routes low-confidence pairs to quarantine |
| **Discrepancy & Audit Agent** | Decomposes fee variances (MDR 2%, GST 18%), generates Big-4-style audit memos, and seals all decisions into the Merkle tree |

---

## Features

### Core Reconciliation
- **Flexible Multi-Source Ingestion:** Operates on any 2 out of 3 sources (bilateral) or full 3-way triangulation — no rigid file requirements
- **O(1) Fast-Path Matching:** Inverted hash index for clean UTR/invoice lookups before falling back to fuzzy scoring
- **5-Channel Orthogonal Scoring:** Weighted signal combination across reference IDs, narrations, amounts, and timestamps
- **Abstention on Ambiguity:** Records with a confidence gap < 8% between top-2 candidates are quarantined rather than force-matched
- **Conformal Risk Profiling:** When synthetic ground truth is available, computes distribution-free confidence bounds (Angelopoulos et al., Stanford CRC)

### Enterprise Outputs
- **ERP Journal Vouchers:** Auto-generated balanced double-entry Debit/Credit vouchers exported as Tally XML and Zoho JSON
- **Bank Dispute Claims:** Statutory NPCI Form-1 recovery letters with embedded UTR evidence (PSS Act 2007 §10)
- **Nodal Escrow Flow:** 4-stage RBI-compliant flow visualization with MDR fee splits, 18% GST deductions, and T+0/T+1/T+2 liquidity aging
- **SHA-256 Merkle Audit Tree:** Cryptographic tamper-evident attestation of all reconciliation decisions
- **Statutory Audit Dossier:** Structured RBI Master Direction §25A export for external auditors

### Intelligence & Operations
- **15-View Enterprise Dashboard:** Built in React 19 + Vite with Framer Motion animations
- **Natural Language Financial Copilot:** Optional Gemini-powered query assistant grounded in run data (falls back to rule-based if no API key)
- **Threshold Playground:** Interactive confidence threshold adjustment with live precision/recall sweep
- **Agent Trace Explorer:** Step-by-step reasoning trace for every individual transaction decision
- **6 Pre-built Simulation Scenarios:** Mass refund storm, RTGS timing lag, MDR overcharge, and more

---

## Benchmark Metrics

> Tested on a standard developer machine (Intel Core i7 / 16 GB RAM) using the bundled synthetic seed (`seed=42`, 70 bank records × 100 ledger entries × settlement feed).

| Metric | Observed Value | Notes |
|:---|:---|:---|
| **Match Rate** | ~85–92% | Varies with narration quality and UTR availability |
| **Throughput** | ~2.1 s per 1,000-record batch | Single-threaded, in-memory, no database I/O |
| **MDR & GST Decomposition** | High precision on contractual fee structures | Based on fixed 2% MDR + 18% GST rules |
| **Abstention Rate** | ~5–12% of records quarantined | Records where Δ score < 0.08 between top-2 candidates |
| **Conformal Error Bound (α)** | ≤ 0.001 target | Requires ground-truth labels; not applicable on unlabelled real-world data |
| **Merkle Root Generation** | < 5 ms per run | SHA-256 over all finalized match pairs |

> **Important:** All metrics above are measured on **synthetic, labelled benchmark data** generated by `data_generator.py`. Performance on real-world production data will vary based on data quality, narration consistency, UTR availability, and institutional formatting differences. The system is a research prototype and should be validated against production data before operational deployment.

---

## Quick Start (Local)

Requires **Python 3.10+** and **Node.js 18+**.

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
cd frontend
npm install
npm run dev
```

- **Dashboard:** http://localhost:5173
- **API Docs:** http://127.0.0.1:8000/docs

### Optional: Gemini Copilot

```bash
# In .env file — copy from .env.example
GEMINI_API_KEY=your_key_here
```

The natural language Financial Copilot uses `gemini-2.5-flash` when a key is provided. Without a key, it falls back to a deterministic rule-based assistant automatically.

### Running Tests

```bash
# Run all 22 automated test suites
python -m pytest backend/tests/ -v
```

The platform bootstraps a demo run (`demo-run-001`) automatically on startup with 70 bank records, 100 ledger entries, and embedded ground truth for immediate testing.

---

## Project Structure

```text
reconx/
├── backend/
│   ├── main.py                          FastAPI app, in-memory run store, API routes
│   ├── models/
│   │   └── schemas.py                   Pydantic v2 schemas for all inputs and outputs
│   └── engine/
│       ├── orchestrator.py              Multi-phase pipeline orchestrator
│       ├── matcher.py                   O(1) inverted index, reverse sweep, batch settlement
│       ├── scorer.py                    5-channel orthogonal scoring engine
│       ├── data_generator.py            Synthetic multi-source data generator with ground truth
│       ├── audit_exporter.py            SHA-256 Merkle tree, evaluation harness
│       ├── vector_tensor.py             Research: 3D tensor core & Sinkhorn optimal transport
│       ├── graph_solver.py              Research: bipartite graph partitioning & lifecycle DAGs
│       ├── conformal_verifier.py        Conformal risk control & Merkle audit tree
│       └── agents/
│           ├── decision_maker_agent.py  Autonomous 1:1 mutex decision maker
│           ├── narration_parser_agent.py Regex + semantic token extractor for bank narrations
│           ├── discrepancy_agent.py     MDR fee (2%) + GST (18%) forensic decomposition
│           ├── erp_voucher_agent.py     Double-entry journal vouchers (Tally XML / Zoho JSON)
│           ├── bank_dispute_agent.py    Statutory dispute letters (PSS Act 2007 / NPCI Form-1)
│           └── assistant_agent.py       RAG Financial Copilot (Gemini + rule-based fallback)
├── frontend/                            React 19 + Vite 8 — 15 dedicated dashboard views
├── backend/tests/                       22 test suites across matching, scoring, API, and tensors
├── render.yaml                          Render.com deployment blueprint (backend + frontend)
├── run_reconx.py                        One-click dual-server launcher
└── requirements.txt                     Python dependencies
```

---

## API Reference

| Endpoint | Method | Description |
|:---|:---:|:---|
| `POST /upload` | Multipart | Upload 2–3 CSV sources or generate a synthetic batch |
| `POST /run/{run_id}` | JSON | Trigger the reconciliation pipeline |
| `GET /run/{run_id}/status` | JSON | Real-time progress: agent stage, processed count |
| `GET /run/{run_id}/summary` | JSON | Executive KPIs, match rates, Merkle root hash |
| `GET /run/{run_id}/transactions` | Query | Filtered transaction list with confidence scores |
| `GET /run/{run_id}/transaction/{id}` | JSON | Single-transaction forensic trace |
| `GET /run/{run_id}/discrepancies` | JSON | MDR fee splits, GST deductions, timing lags |
| `GET /run/{run_id}/exceptions` | JSON | Bank orphans and ledger orphans |
| `GET /run/{run_id}/erp-vouchers` | JSON/XML | Auto-generated double-entry accounting vouchers |
| `GET /run/{run_id}/disputes` | JSON | NPCI Form-1 statutory dispute letters |
| `GET /run/{run_id}/statutory-dossier` | JSON | RBI §25A audit dossier export |
| `POST /run/{run_id}/recompute` | JSON | Recompute threshold classification without re-running |
| `POST /chat` | JSON | Natural language Financial Copilot query |

Full interactive documentation available at `/docs` (Swagger UI).

---

## Design Decisions

### 1. Why Not Use LLMs or External AI APIs?

Three concrete constraints rule out cloud LLM approaches for Indian fintech reconciliation:

- **Regulatory:** RBI Nodal Escrow guidelines and the DPDP Act 2023 restrict exporting raw transaction PII to external third-party systems. Statutory audits require fully deterministic, reproducible outputs.
- **Accounting Semantics:** Double-entry bookkeeping requires discrete binary decisions — a transaction is either matched or it is not. Probabilistic soft scores from LLMs are incompatible with general ledger posting rules.
- **Operational Cost & Latency:** At NPCI-scale volumes, per-token API costs and 1–3 second LLM inference latency are operationally unviable.

### 2. Production Fast-Path vs. Research Suite

ReconX separates two execution modes intentionally:

| | Production Pipeline | Research Suite |
|:---|:---|:---|
| **Files** | `matcher.py`, `scorer.py`, `orchestrator.py` | `vector_tensor.py`, `graph_solver.py` |
| **Complexity** | O(1) inverted index | O(M×N) dense tensor |
| **Memory (10k rows)** | < 10 MB | ~4 GB |
| **Output** | Discrete 1:1 match or quarantine | Continuous probability distribution |
| **ERP Compatibility** | Direct journal voucher posting | Incompatible with discrete ledger entries |

The Sinkhorn Optimal Transport and bipartite graph solver are maintained as an **offline research harness** (`tests/test_tensor_engine.py`) to benchmark theoretical assignment bounds, not as a live request-path component.

### 3. Abstention Safety Invariant

In financial auditing, a false positive match is significantly more harmful than an unreconciled item. When two candidate matches have a confidence score gap below 8%:

```
If S₁ ≥ τ  AND  (S₁ - S₂) < 0.08  AND  S₂ > 0.65  →  Quarantine
```

The engine routes these records to an AML Suspense Registry for human controller review rather than forcing a guess.

### 4. Conformal Risk Control Scope

Conformal calibration (Angelopoulos et al., Stanford / UC Berkeley) is applied **only when labelled ground truth exists** — specifically, against the synthetic benchmark dataset generated by `data_generator.py`. On real-world unlabelled CSV uploads, the engine marks calibration as `None` and does not attempt to self-generate circular labels. This is an intentional design boundary, not a limitation to be papered over.

### 5. Conservation Invariant

The engine tracks an escrow solvency equation:

```
Σ Bank Inflows − Σ Settled Ledger Outflows ≡ ΔNodal Escrow Balance  (± ₹1.00 rounding tolerance)
```

All finalized decisions are sealed in a SHA-256 Merkle tree, producing a 64-hex root hash. This makes post-hoc ledger manipulation detectable, though it does not replace a full cryptographic audit system.

---

## Roadmap

| Phase | Target Capabilities |
|:---|:---|
| **Phase 1 (Current)** | End-to-end matching pipeline, 4 agents, 15 React views, Merkle sealing, research tensor suite |
| **Phase 2** | PostgreSQL/TimescaleDB persistence, Apache Kafka streaming ingestion, replacing in-memory `RunSession` |
| **Phase 3** | Redis distributed lock (`Redlock`) for multi-worker horizontal scaling |
| **Phase 4** | Direct SFTP/REST connectors for HDFC/ICICI host-to-host nodal feeds; SAP S/4HANA OData voucher posting |

---

## Engineering Notes

- **In-Memory Store:** All run sessions are held in a Python dictionary (`RUNS` in `backend/main.py`). This means run data does not persist across server restarts. This is intentional for the prototype — a database adapter is the Phase 2 priority.
- **Data Residency:** Core matching, decomposition, voucher generation, and Merkle hashing execute entirely on-process with no network egress of financial records, consistent with DPDP Act 2023 data localisation expectations.
- **Simulation Scenarios:** The frontend includes 6 pre-configured treasury edge-case scenarios (mass refund storm, RTGS timing lag, MDR overcharge) accessible from the Scenarios view.
- **Free-Tier Deployment:** The live demo runs on Render's free tier. The backend instance sleeps after 15 minutes of inactivity and takes ~30–50 seconds to wake up on the first request.

---

Developed for **Track 04: AI Finance Controller** at **Razorpay Buildathon 2026**.  
Licensed under the [MIT License](LICENSE).
