# ReconX Project Overview

## 1. Executive Summary
**ReconX** is an autonomous multi-source financial reconciliation and treasury intelligence platform built for Indian payment aggregators and merchants (e.g. handling RBI Nodal / Escrow account settlements). It reconciles three disjoint financial streams:
1. **Bank Statement** (External bank credits/debits, UTR numbers, unstructured narration strings).
2. **Internal ERP Ledger** (Order IDs, gross amounts, merchant fees, refunds, invoice references).
3. **Payment Gateway Network Settlement Reports** (Batch IDs, payment rails, interchange/MDR fees, net payouts).

The engine executes deterministic multi-signal candidate scoring, 1-to-1 claiming, reverse sweeps for ledger orphans, automated discrepancy decomposition (MDR fee leakage, T+1/T+2 timing lags, partial refund clawbacks, GST paisa rounding), double-entry ERP journal voucher generation (Tally Prime XML & SAP JSON), and Copilot chat assistance.

---

## 2. Technical Stack & Architecture

### Backend
- **Language / Runtime:** Python 3.11+ (running on Python 3.13.14).
- **Framework:** FastAPI with Uvicorn ASGI server.
- **Data & Computation:** Pandas, NumPy, RapidFuzz for fuzzy string matching.
- **LLM Integration:** Google Gemini (`google-genai` SDK, configured with `gemini-3.8-flash` via `llm_gateway.py`).
- **Validation:** Pydantic v2 schemas.
- **Testing:** Pytest (64 test cases across 10 modules in `backend/tests/`).

### Frontend
- **Framework:** React 19 + Vite 8.
- **Styling:** Vanilla CSS with custom design tokens (`frontend/src/index.css`).
- **Animation & Icons:** Framer Motion, Lucide React.
- **Markdown Rendering:** React Markdown + Remark GFM.
- **API Client:** Native Fetch wrapper with `AbortController` timeouts, structured error handling, and exponential backoff retry.

---

## 3. Repository Structure & Entry Points

```
razorpay/
├── backend/
│   ├── main.py                  # FastAPI server entry point, CORS & lifespan config
│   ├── models/schemas.py        # Pydantic request/response data contracts
│   ├── services/
│   │   ├── run_service.py       # Reconciliation run lifecycle & state management
│   │   ├── run_repository.py    # In-memory repository with TTL eviction & bounding
│   │   ├── ingestion_service.py # CSV parsing, validation, synthetic data generation
│   │   └── export_service.py    # Report rendering & CSV export sanitization
│   ├── routers/
│   │   ├── runs.py              # /upload, /run/{id}, /status, /recompute
│   │   ├── reconciliation.py    # /transactions, /discrepancies, /exceptions, /trace
│   │   ├── assistant.py         # /chat Copilot endpoints
│   │   ├── reports.py           # /report, /download CSV/JSON
│   │   └── actions.py           # /erp-vouchers, /disputes, /statutory-dossier
│   ├── engine/
│   │   ├── data_generator.py    # Synthetic banking batch generator
│   │   ├── scorer.py            # Multi-signal deterministic scoring engine
│   │   ├── matcher.py           # Candidate search, indexing, reverse sweep
│   │   ├── orchestrator.py      # Core pipeline coordinator
│   │   ├── conformal_verifier.py# Empirical threshold selection & Merkle SHA-256 tree
│   │   ├── audit_exporter.py    # Evaluation harness & run report formatting
│   │   ├── llm_gateway.py       # Centralized Gemini LLM client & PII redaction
│   │   ├── vector_tensor.py     # Offline 3D tensor & Sinkhorn OT research harness
│   │   ├── graph_solver.py      # Offline bipartite graph solver research harness
│   │   └── agents/
│   │       ├── decision_maker_agent.py   # Triage & matching routing coordinator
│   │       ├── discrepancy_agent.py      # Variance decomposition & story generator
│   │       ├── narration_parser_agent.py # Regex & linguistic token extractor
│   │       ├── assistant_agent.py        # Natural language treasury copilot
│   │       ├── erp_voucher_agent.py      # Double-entry Tally XML voucher generator
│   │       └── bank_dispute_agent.py     # Bank dispute & NPCI claim builder
│   └── tests/                   # Full Pytest test suite (64 tests)
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── src/
│   │   ├── main.jsx             # React DOM root entry point
│   │   ├── App.jsx              # Main tab coordinator & global state
│   │   ├── api.js               # Centralized API client
│   │   ├── index.css            # Design system & dark theme tokens
│   │   ├── components/          # Reusable UI widgets (Sidebar, PageHeader, Toast, Drawer, CommandPalette)
│   │   └── views/               # 16 domain views (Transactions, Scenarios, ERP, Disputes, etc.)
└── docs/                        # Project audit ledgers, fix plans, and documentation
```

---

## 4. How to Install, Run, and Test

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### Backend Installation & Startup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the backend dev server
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend Installation & Startup
```bash
cd frontend
npm install
npm run dev
# Running at http://localhost:5173
```

### Running Tests
```bash
# Run backend test suite
pytest backend/tests/

# Run frontend production build
npm --prefix frontend run build

# Run frontend linter
npm --prefix frontend run lint
```
