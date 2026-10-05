# Backend Modular Architecture Implementation Plan

- **Goal:** Split `backend/main.py` into application services and modular routers, replacing eager import execution with a FastAPI `lifespan` handler (F-01 and F-03).
- **Target Specification:** [`docs/superpowers/specs/2026-10-05-backend-modular-architecture-design.md`](file:///e:/PROJECTS/razorpay/docs/superpowers/specs/2026-10-05-backend-modular-architecture-design.md)

---

## Proposed Changes

### Phase 1: Application Services Layer (`backend/services/`)
- [ ] **Task 1.1**: Create `backend/services/__init__.py`.
- [ ] **Task 1.2**: Create `backend/services/ingestion_service.py` with limits, schemas, `normalize_uploaded_frame`, and `generate_synthetic_run`.
- [ ] **Task 1.3**: Create `backend/services/export_service.py` with `escape_csv_formula_value`, `build_report_display`, and `build_transactions_csv`.
- [ ] **Task 1.4**: Create `backend/services/run_service.py` with `RunSession`, `RUNS`, `init_default_demo_run`, `execute_pipeline_task`, and `recompute_run`.
- [ ] **Task 1.5**: Test importing `backend.services` to ensure instant load time.

### Phase 2: Presentation Routers Layer (`backend/routers/`)
- [ ] **Task 2.1**: Create `backend/routers/__init__.py`.
- [ ] **Task 2.2**: Create `backend/routers/runs.py` (`/upload`, `/run/{id}`, `/run/{id}/status`, `/run/{id}/sources`).
- [ ] **Task 2.3**: Create `backend/routers/reconciliation.py` (`/run/{id}/transactions`, `/transaction/{id}`, `/trace/{id}`, `/discrepancies`, `/exceptions`, `/summary`, `/recompute`, `/threshold_sweep`).
- [ ] **Task 2.4**: Create `backend/routers/assistant.py` (`/chat`).
- [ ] **Task 2.5**: Create `backend/routers/reports.py` (`/run/{id}/report`, `/run/{id}/report/download`).
- [ ] **Task 2.6**: Create `backend/routers/actions.py` (`/run/{id}/erp-vouchers`, `/erp-vouchers/tally-xml`, `/disputes`, `/statutory-dossier`, `/statutory-dossier/download`).

### Phase 3: Slim `backend/main.py` Entrypoint
- [ ] **Task 3.1**: Rewrite `backend/main.py` to use `lifespan`, register routers, and re-export legacy symbols for 100% test compatibility.

### Phase 4: Verification & Regression Testing
- [ ] **Task 4.1**: Verify import latency: `python -c "import backend.main"` < 1s.
- [ ] **Task 4.2**: Run fast unit test suite: `test_verified_fixes.py`, `test_voucher_review.py`, `test_data_integrity.py`.
- [ ] **Task 4.3**: Run API test suite: `backend/tests/test_api.py`.
- [ ] **Task 4.4**: Commit changes.

---

## Verification Plan
1. `python -c "import time; t=time.time(); import backend.main; print(f'Import time: {time.time()-t:.2f}s')"` must print `< 1.0s`.
2. Pytest on all unit test suites must be 100% passing.
3. Pytest on `test_api.py` must pass with zero errors.
