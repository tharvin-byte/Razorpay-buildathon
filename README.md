like i# ReconX — Autonomous Financial Reconciliation & Treasury Solvency Engine

[![ReconX YouTube Video Demo](https://img.shields.io/badge/▶_Watch_Full_Demo_on_YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/lrncP_iNwpM?si=mMvm-FgduKV0cY1K)
> **Direct Video Link:** [https://youtu.be/lrncP_iNwpM?si=mMvm-FgduKV0cY1K](https://youtu.be/lrncP_iNwpM?si=mMvm-FgduKV0cY1K)

ReconX reconciles multi-source financial inflows (Nodal Bank Statements, ERP General Ledgers, and Payment Gateway Settlement feeds) at scale. A deterministic multi-tier matching engine — using an $\mathcal{O}(1)$ inverted hash index fast-path, 5-channel orthogonal scoring, and combinatorial batch netting — resolves clean matches and isolates discrepancies (MDR fees, 18% statutory GST splits, timing lags). For unresolvable or ambiguous candidate pairs ($\Delta < 0.08$), the engine **strictly abstains from probabilistic guessing** and quarantines transactions into an AML suspense registry. Autonomous action bots synthesize balanced double-entry ERP vouchers (Tally XML / Zoho JSON) and statutory NPCI Form-1 dispute recovery letters (PSS Act 2007 §10), while every finalized decision is sealed in an immutable SHA-256 Merkle audit tree.

This is an end-to-end **Phase 1 vertical slice**: every layer in the target architecture is implemented end-to-end with production-shaped interfaces, using high-performance local in-memory run stores and offline mathematical benchmark suites (`backend/tests/test_tensor_engine.py`), running immediately with zero external cloud dependencies or paid API keys.

---

## Live Pipeline Architecture

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────────┐
│ Nodal Bank Feed │       │ ERP Ledger Feed │       │ Gateway Settlements │
└────────┬────────┘       └────────┬────────┘       └──────────┬──────────┘
         └─────────────────┬───────┴───────────────────────────┘
                           │
                 [ Inverted Index O(1) ]
                 Fast-path UTR & Invoice Hash Lookup
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
     [ Exact Match ]            [ Fuzzy / Discrepancy ]
     Score = 1.0                NarrationParserAgent (Subword Tokens)
             │                  5-Channel Orthogonal ScoringTool:
             │                  • Exact UTR Hash (0.45)
             │                  • Invoice / Order Ref (0.25)
             │                  • Counterparty RapidFuzz (0.15)
             │                  • Amount & MDR Kernel (0.10)
             │                  • Date Proximity Window (0.05)
             │                           │
             └─────────────┬─────────────┘
                           │
           [ DecisionMakerAgent (1:1 Mutex) ]
           Conflict Detector & Zero-Guessing Filter (< 8% Δ)
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    [ Matched / Discrepancy ]       [ Quarantined Exception ]
    DiscrepancyDecompositionAgent   AML Suspense Registry
    (2% MDR Fee & 18% GST Split)    (Controller Verification Required)
             │                                   │
             ▼                                   ▼
    [ ERPVoucherAgent ]             [ BankDisputeAgent ]
    Tally XML / Zoho JSON           NPCI Form-1 Letter (PSS Act 2007)
             │                                   │
             └─────────────┬─────────────────────┘
                           │
            [ SHA-256 Merkle Audit Tree ]
            Immutable Attestation Root (64-hex)
```

---

## Quick start

Requires Python 3.10+ and Node.js 18+.

```bash
# Clone the repository
git clone https://github.com/tharvin-byte/Razorpay-buildathon.git reconx && cd reconx

# Option A: One-Click Unified Launch (Recommended)
python run_reconx.py
```

Or start the services in separate terminals:

```bash
# Terminal 1: FastAPI Backend + Deterministic Matching Engine
pip install -r requirements.txt # or: pip install fastapi uvicorn pandas numpy rapidfuzz pydantic pytest
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
# Terminal 2: Enterprise Treasury Console (React 18 + Vite 6)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173/** for the ReconX Intelligence Dashboard, or **http://127.0.0.1:8000/docs** for the interactive Swagger API documentation.

### Demo Run & Ground-Truth Verification
The platform automatically bootstraps a verified multi-source demo batch on startup (`demo-run-001`):
- **Bank Records:** 70 transactions across UPI, IMPS, NEFT, RTGS
- **Internal Ledger:** 100 merchant order captures
- **Settlement Feed:** Aggregator batch fee & tax deductions
- **Independent Ground Truth:** Embedded synthetic labels to evaluate precision, recall, and conformal error bounds.

In a third terminal (optional test check):
```bash
python -m pytest backend/tests/test_api.py -v
```

Everything above runs **100% offline** with zero external API keys.

### Using Gemini for Natural Language Copilot (Optional)
```bash
# In your .env file:
GEMINI_API_KEY=your_gemini_api_key_here
```
When configured, the interactive Financial Copilot drawer (`/chat`) uses Google's `gemini-2.5-flash` to answer natural language treasury queries grounded in the reconciled run data. If no key is set, the Copilot gracefully falls back to a deterministic rule-based assistant.

---

## Verifying it works

```bash
# Execute all 22 automated tests across matching, decomposition, ERP vouchers, disputes, and tensor benchmarks:
python -m pytest backend/tests/ -v
```

### Reference Benchmark Metrics (Bundled Seed = 42)
*Tested on standard developer hardware (Intel Core i7 / 16GB RAM):*
- **Match Rate:** ~85–92% across heterogeneous dirty narrations and timing lags.
- **Throughput:** ~2.1 seconds per 1,000-record multi-source batch.
- **MDR & GST Separation Accuracy:** 100% mathematical precision on contractual fee decompositions.
- **Conservation of Money:** Zero balance leakage ($|\sum \text{Bank} - \sum \text{Ledger}| \le ₹1.00$).
- **Zero-Guessing Invariant:** 100% abstention on ambiguous pairs ($\Delta < 0.08$ score delta).

---

## Project layout

```text
backend/
├── main.py                          FastAPI application, in-memory run store, and API routes
├── models/
│   └── schemas.py                   Pydantic v2 schemas for multi-source inputs, results, and KPIs
├── engine/
│   ├── orchestrator.py              Reconciliation orchestrator, Merkle tree sealing, conformal profiler
│   ├── matcher.py                   O(1) Inverted Index, Reverse-Sweep tool, and BatchSettlementTool
│   ├── scorer.py                    5-channel orthogonal scoring tool (Levenshtein, amount, date decay)
│   ├── data_generator.py            Synthetic multi-source financial generator with hidden ground truth
│   ├── audit_exporter.py            SHA-256 Merkle tree exporter, EvaluationHarness, RBI Form 3CB
│   ├── vector_tensor.py             R&D: 3D Multi-Signal Tensor Core & Sinkhorn Optimal Transport
│   ├── graph_solver.py              R&D: Bipartite Graph Partitioning & Lifecycle DAG Netting
│   └── agents/
│       ├── decision_maker_agent.py  Autonomous decision-maker agent with 1-to-1 linear claim mutex
│       ├── narration_parser_agent.py Regex and semantic subword extraction for truncated bank narrations
│       ├── discrepancy_agent.py     Forensic MDR fee (2%) and 18% statutory GST decomposition
│       ├── erp_voucher_agent.py     Self-healing double-entry journal vouchers (Tally XML / Zoho JSON)
│       ├── bank_dispute_agent.py    Statutory dispute claim letters (PSS Act 2007 §10(2) / NPCI Form-1)
│       └── assistant_agent.py       RAG-grounded Financial Copilot (Gemini 2.5 Flash with rule fallback)
frontend/                            React 18 + Vite 6 treasury console (15 dedicated views)
backend/tests/                       22 automated test suites verifying correctness and invariants
run_reconx.py                        One-click dual-server launcher
```

---

## API surface

| Endpoint | Method | Purpose |
|:---|:---:|:---|
| `POST /upload` | Multipart | Ingests 2–3 CSV sources or generates a synthetic test batch (`generate_synthetic=true`) |
| `POST /run/{run_id}` | JSON | Triggers the autonomous multi-tier reconciliation pipeline |
| `GET /run/{run_id}/status` | Polling | Returns real-time execution progress, active agent stage, and processed count |
| `GET /run/{run_id}/summary` | JSON | Returns executive KPIs, match rates, discrepancy counts, and Merkle root hash |
| `GET /run/{run_id}/transactions`| Query | Returns filtered master transaction list with confidence scores and signals |
| `GET /run/{run_id}/transaction/{id}`| JSON | Returns single-transaction forensic evidence trail and agent trace steps |
| `GET /run/{run_id}/discrepancies` | JSON | Returns fee deductions, 18% GST splits, and timing lag breakdowns |
| `GET /run/{run_id}/exceptions` | JSON | Returns segregated bank orphans and ledger orphans with leakage exposure |
| `GET /run/{run_id}/vouchers` | JSON/XML | Auto-generates balanced double-entry accounting vouchers (Tally XML / Zoho JSON) |
| `GET /run/{run_id}/disputes` | JSON | Generates formal statutory NPCI Form-1 dispute recovery notice letters |
| `GET /run/{run_id}/audit-dossier` | JSON | Exports RBI Master Direction Section 25A Statutory Audit Dossier |
| `POST /run/{run_id}/recompute` | JSON | Recomputes threshold classification in $< 20\text{ms}$ without re-running pipeline |
| `POST /chat` | JSON | RAG-grounded Financial Copilot assistant for conversational treasury queries |

*Interactive OpenAPI Swagger documentation available at `/docs` when the backend is running.*

---

## Architecture & Engineering Design Decisions

### 1. Dual-Tier Strategy: Production Fast-Path vs. R&D Research Suite
ReconX cleanly decouples real-time operational execution from academic batch optimization:
- **Live Production Pipeline (`engine/matcher.py`, `engine/scorer.py`, `engine/orchestrator.py`):**  
  In enterprise banking operations, processing thousands of streaming records through dense $M \times N$ matrices or iterative Sinkhorn exponentials introduces severe $\mathcal{O}(M \times N)$ memory allocations (e.g., $10\text{k} \times 10\text{k} \times 5 = 500\text{M}$ floats $\approx 4\text{ GB}$ of RAM) and latency spikes ($> 2.5\text{s}$). Furthermore, production web interfaces require row-by-row, chronological **Agent Trace Events** (`Planner`, `Matcher`, `Discrepancy Agent`) and discrete 1:1 ledger claims. ReconX resolves clean transactions in $< 0.2\text{ms}$ via an $\mathcal{O}(1)$ Inverted Multi-Index (`utr_to_ledger`, `inv_to_ledger`), falling back to orthogonal 5-channel heuristic scoring for messy narrations.
- **R&D Benchmark Suite (`backend/engine/vector_tensor.py`, `graph_solver.py`):**  
  We implemented and benchmarked dense 3D Tensor Cores, entropy-regularized Sinkhorn Optimal Transport (Cuturi et al.), and Bipartite Graph Partitioning in our research test suite (`backend/tests/test_tensor_engine.py`). This benchmark proves mathematical bounds for high-dimensional edge cases, while keeping the production runtime lightweight, sub-second, and deterministic.

### 2. 5-Channel Orthogonal Scoring Engine
When UTRs are absent or truncated, candidate rows are scored using normalized orthogonal signals:
- **Exact UTR Match ($w_0 = 0.45$):** Binary match on alphanumeric reference tokens.
- **Invoice / Order Ref ($w_1 = 0.25$):** Substring and fuzzy token matching against narration metadata.
- **Counterparty Name ($w_2 = 0.15$):** RapidFuzz token-sort similarity against merchant customer directories.
- **Amount & MDR Kernel ($w_3 = 0.10$):** Gaussian tolerance kernel accounting for 0.5%–2.5% MDR gateway deductions and refunds.
- **Date Decay Proximity ($w_4 = 0.05$):** Exponential decay within a 3-day statutory settlement window.

### 3. Zero-Guessing Safety Invariant ($\Delta < 0.08$)
In financial auditing, **a false positive match is 10x more destructive than an un-reconciled item**. When competing ledger candidates have confidence scores separated by less than 8%:
$$\text{If } S_1 \ge \tau \quad\land\quad (S_1 - S_2) < 0.08 \quad\land\quad S_2 > 0.65 \implies \text{Quarantine}$$
The engine strictly abstains from guessing and routes the record to an AML Suspense Registry with transparent diagnostic root causes.

### 4. Non-Circular Conformal Risk Profiling
Conformal calibration requires independent ground truth. ReconX binds directly to synthetic benchmark ground truth (`gt_is_match_map`) when available to compute mathematically sound finite-sample risk bounds ($\alpha \le 0.001$). On raw, unlabelled real-world CSV uploads where ground truth does not exist, the engine marks the calibration as `None` rather than synthesizing circular self-referential labels.

### 5. Conservation of Escrow Solvency Invariant
$$\sum \text{Bank Inflows} - \sum \text{Settled Ledger Outflows} \equiv \Delta \text{Nodal Escrow Balance} \quad (\pm ₹1.00 \text{ rounding})$$
Every transaction state transition is sealed in a binary SHA-256 Merkle Audit Tree (`MerkleAuditTree.build_merkle_root`), producing a 64-hex root hash that makes post-hoc ledger manipulation mathematically impossible.

---

## Production Roadmap & Next Steps

Each development session can build on this foundation:
1. **Session 1 (This Phase 1 Slice):** End-to-end multi-tier matching engine, 4 cognitive agents + 2 action bots, 15 React 18 views, Merkle tree sealing, and R&D tensor test suite.
2. **Session 2 (Storage & Streaming):** PostgreSQL/TimescaleDB persistence adapter (replacing in-memory `RunSession`), Apache Kafka / Redpanda event ingestion for real-time streaming webhook feeds.
3. **Session 3 (Distributed Concurrency):** Redis distributed lock manager (`Redlock`) replacing in-memory `claimed_ledger_ids` for multi-worker scaling.
4. **Session 4 (Enterprise Connectors):** Direct REST/SFTP polling connectors for HDFC/ICICI nodal host-to-host bank statement feeds and SAP S/4HANA OData voucher posting.

---

## Engineering Notes

- **In-Memory Store:** The default execution uses in-process memory sessions (`RUNS` dictionary in `backend/main.py`), keeping tests, demos, and local runs completely frictionless without requiring Docker or database setup.
- **Data Residency (DPDP Act 2023):** Core matching, discrepancy decomposition, voucher generation, and Merkle tree hashing execute 100% locally on CPU with zero network egress of financial records.
- **Simulation Sandbox:** The frontend includes 6 pre-configured treasury edge-case scenarios (mass refund storm, RTGS timing lag, MDR overcharge) that post to `/upload` exactly as real external feeds would.

---

Developed for **Track 04: AI Finance Controller** at **Razorpay Buildathon 2026**.  
*Licensed under the [MIT License](LICENSE).*
