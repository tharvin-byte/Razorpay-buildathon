# ReconX Backend Modular Architecture Design Specification

- **Date:** 2026-10-05
- **Topic:** Backend Modular Architecture & Lifespan Migration (Findings F-01 & F-03)
- **Status:** Approved for Implementation

---

## 1. Problem Statement & Objectives

### Current State
`backend/main.py` has grown into a 766-line "god-module" combining HTTP configuration, in-memory state management, file upload validation, background task execution, and 18+ API routes. Furthermore, line 233 executes `init_default_demo_run()` synchronously on module import, blocking test runners and server startups for 30–45+ seconds.

### Objectives
1. **Eliminate the God-Module (F-01):** Separate HTTP routing from core business logic by introducing an application services layer (`backend/services/`) and modular routers (`backend/routers/`).
2. **Eliminate Import-Time Execution (F-03):** Replace the top-level demo run execution with a FastAPI `lifespan` handler so that module import completes in < 0.5s.
3. **100% Backward Compatibility:** Preserve all existing endpoint paths, parameters, schemas, and public symbol exports so existing frontend code and test suites (`test_api.py`) continue to pass without modification.

---

## 2. Target Component Architecture

```
backend/
├── main.py                     # Entrypoint (~50 lines): FastAPI instance, CORS, lifespan, router inclusion
├── services/                   # Application layer (pure Python business logic)
│   ├── __init__.py
│   ├── run_service.py          # RunSession model, RUNS in-memory repository, lifecycle & orchestrator runner
│   ├── ingestion_service.py    # CSV validation, normalize_uploaded_frame, synthetic generation
│   └── export_service.py       # Report generation, CSV formula escaping
├── routers/                    # Presentation layer (FastAPI APIRouters)
│   ├── __init__.py
│   ├── runs.py                 # /upload, /run/{id}, /run/{id}/status, /run/{id}/sources
│   ├── reconciliation.py       # /run/{id}/transactions, /transaction/{id}, /trace/{id}, /discrepancies, /exceptions, /summary, /recompute, /threshold_sweep
│   ├── assistant.py            # /chat
│   ├── reports.py              # /run/{id}/report, /run/{id}/report/download
│   └── actions.py              # /run/{id}/erp-vouchers, /erp-vouchers/tally-xml, /disputes, /statutory-dossier, /statutory-dossier/download
├── engine/                     # Domain Engine (matcher, scorer, orchestrator, agents)
├── models/                     # Pydantic schemas (schemas.py)
└── tests/                      # Pytest suite
```

---

## 3. Component Details & Boundaries

### 3.1. Application Services Layer (`backend/services/`)

#### `run_service.py`
- **Responsibilities:**
  - `RunSession`: Dataclass holding run state, dataframes, progress counters, orchestrator reference, and `operation_lock`.
  - `RUNS`: Dictionary mapping `run_id` to `RunSession`.
  - `init_default_demo_run(force: bool = False)`: Lazily or conditionally runs the synthetic demo pipeline.
  - `execute_pipeline_task(run_id: str, threshold: float)`: Background worker function orchestrating pipeline execution, logging progress, and managing lock/error states.
  - `recompute_run(run_id: str, threshold: float) -> SummaryResponse`: Recomputes reconciliation under `operation_lock`.
  - Helper queries: `get_session(run_id: str)`, `list_active_runs()`.

#### `ingestion_service.py`
- **Responsibilities:**
  - Schema constants: `MAX_UPLOAD_BYTES`, `MAX_SOURCE_ROWS`, `MAX_SYNTHETIC_BANK_ROWS`, `MAX_FIELD_LENGTH`.
  - Column sets: `SOURCE_REQUIRED_COLUMNS`, `SOURCE_ID_COLUMNS`.
  - `normalize_uploaded_frame(frame: pd.DataFrame, source: str) -> pd.DataFrame`: Validates row/column counts, string lengths, ID duplicates, dates, numeric constraints, and currency.
  - `generate_synthetic_run(records_count: int, seed: int)`: Wrapper around `SyntheticDataGenerator.generate_batch()`.

#### `export_service.py`
- **Responsibilities:**
  - `escape_csv_formula_value(value: Any) -> Any`: Sanitizes values starting with `=`, `+`, `-`, `@` to prevent formula injection.
  - `build_report_display(session: RunSession) -> Dict[str, Any]`: Formats summary metrics, orphan exception tables, and discrepancy highlights.
  - `build_transactions_csv(results: List[ReconciliationResult]) -> str`: Serializes results to sanitized CSV format.

---

### 3.2. Presentation Layer (`backend/routers/`)

Each router defines an `APIRouter()` with relevant tags and cleanly delegates to domain services:
- **`runs.py`**:
  - `POST /upload`: Handles multipart upload or synthetic generation. Maintains 503 guard on uploaded files.
  - `POST /run/{run_id}`: Launches background reconciliation execution with 409 duplicate-run guard.
  - `GET /run/{run_id}/status`: Returns `RunStatusResponse`.
  - `GET /run/{run_id}/sources`: Returns metadata and sample rows of source frames.
- **`reconciliation.py`**:
  - `GET /run/{run_id}/transactions`: List filtered transactions.
  - `GET /run/{run_id}/transaction/{txn_id}`: Detail for a single transaction.
  - `GET /run/{run_id}/trace/{txn_id}`: Step-by-step agent trace.
  - `GET /run/{run_id}/discrepancies`: Filtered discrepancy results.
  - `GET /run/{run_id}/exceptions`: Side-filtered exception results.
  - `GET /run/{run_id}/summary`: Summary metrics.
  - `POST /run/{run_id}/recompute`: Re-thresholding without LLM repetition.
  - `GET /run/{run_id}/threshold_sweep`: Sensitivity points.
- **`assistant.py`**:
  - `POST /chat`: Copilot Q&A endpoint.
- **`reports.py`**:
  - `GET /run/{run_id}/report`: JSON report structure.
  - `GET /run/{run_id}/report/download`: Download JSON or CSV attachment.
- **`actions.py`**:
  - `GET /run/{run_id}/erp-vouchers`: Balanced vouchers + manual review items.
  - `GET /run/{run_id}/erp-vouchers/tally-xml`: Tally XML download.
  - `GET /run/{run_id}/disputes`: Abstaining dispute claims response.
  - `GET /run/{run_id}/statutory-dossier`: Run report summary.
  - `GET /run/{run_id}/statutory-dossier/download`: Plain text dossier download.

---

### 3.3. Entrypoint & Lifespan (`backend/main.py`)

- **Lifespan Handler:**
  ```python
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # Initialize default demo run during server or TestClient startup
      if os.environ.get("RECONX_SEED_DEMO", "true").lower() in ("true", "1", "yes"):
          init_default_demo_run()
      yield
  ```
- **App Instantiation:** `app = FastAPI(title="ReconX API", lifespan=lifespan)`
- **CORS Middleware:** Configured with origins from `RECONX_ALLOWED_ORIGINS`.
- **Router Mounting:** Includes routers with both primary paths and `/api/v1` compatibility prefixes.
- **Backward-Compatible Re-Exports:**
  ```python
  from backend.services.run_service import RUNS, RunSession, init_default_demo_run
  from backend.services.ingestion_service import normalize_uploaded_frame as _normalize_uploaded_frame
  from backend.services.export_service import escape_csv_formula_value as _escape_csv_formula_value
  ```

---

## 4. Error Handling & Invariants

1. **Concurrency Safety:** Every run execution and threshold recomputation acquires `session.operation_lock`. Duplicate parallel runs return HTTP `409 Conflict`.
2. **Missing Run Handling:** All endpoints querying a non-existent `run_id` return HTTP `404 Not Found`.
3. **Upload Policy:** Uploads of external CSVs return HTTP `503 Service Unavailable` with instructions to use synthetic demo runs until authenticated storage is enabled.
4. **CSV Injection Protection:** All CSV download rows are sanitized through `_escape_csv_formula_value`.

---

## 5. Verification Plan

1. **Import Latency:**
   - Execute: `python -c "import time; t0=time.time(); import backend.main; print(f'Import took {time.time()-t0:.2f}s')"`
   - Success Criterion: Import time < 1.0s (previously timed out > 30s).
2. **Fast Unit Tests:**
   - Run: `pytest backend/tests/test_verified_fixes.py backend/tests/test_voucher_review.py backend/tests/test_data_integrity.py`
   - Success Criterion: All 32 tests pass.
3. **API Contract Tests:**
   - Run: `pytest backend/tests/test_api.py`
   - Success Criterion: All endpoints pass under `TestClient(app)`.
