# ReconX Master-Level Fix Plan

This plan groups findings from `docs/audit-ledger.md` by root cause, ordered by severity and architectural dependency.

---

## Group 1: Character Encoding & Corrupted Mojibake (L-15, L-22, L-29, L-31)
- **Severity:** HIGH / USER-FACING
- **Root Cause:** Corrupted Windows-1252 to UTF-8 re-encoding in previous edits created `â‚¹` (mojibake for `₹`), `âˆ’` (mojibake for `−`), and in `ThresholdPlaygroundView.jsx`, a corrupted rupee was replaced with a literal `?`.
- **Industry Standard Fix:** Restore pristine UTF-8 Indian Rupee (`₹`) and typographical minus sign (`−`) consistently across all backend explanations and frontend UI templates.
- **Alternatives Rejected:** Using ASCII "Rs." or "INR" everywhere (rejected because the UI design system specifically expects standard currency glyph `₹`).
- **Files Touched:**
  - `backend/engine/agents/discrepancy_agent.py`
  - `backend/engine/agents/assistant_agent.py`
  - `frontend/src/views/ThresholdPlaygroundView.jsx`
  - `frontend/src/views/ScenariosView.jsx`
- **Regression Risk:** Low (pure string template formatting).
- **Verification:**
  - Run `grep "â‚¹"` across project to guarantee 0 occurrences.
  - Verify `ThresholdPlaygroundView.jsx` displays `₹` correctly.
  - Run `pytest backend/tests/` and `npm --prefix frontend run build`.

---

## Group 2: FinTech & Scoring Engine Logic Corrections (L-06, L-14, L-19, L-24)
- **Severity:** HIGH / FINANCIAL INTEGRITY
- **Root Cause:** Logical oversights in edge-case handling across financial accounting rules and scoring math.
- **Industry Standard Fixes:**
  1. **Scorer Proximity (L-06):** In `backend/engine/scorer.py`, compute raw signed days `days_diff = (d_bank - d_ledger).days`. If `days_diff < 0` (money arrived prior to order placement), do not award normal settlement lag points; treat as an anomaly.
  2. **Double-Entry Orientation (L-19):** In `backend/engine/agents/erp_voucher_agent.py`, evaluate the sign of the variance delta. On net shortage (loss), Debit Rounding Variance; on net surplus (gain), Credit Rounding Variance and Debit Settlement Control to guarantee accurate ledger balance.
  3. **Precision Math Fallback (L-24):** In `backend/engine/audit_exporter.py`, if `predicted_positives == 0`, set `precision = 0.0` (or `None`), not `1.0`.
  4. **Reference Formatting Check (L-14):** In `backend/engine/agents/discrepancy_agent.py`, perform case-insensitive regex search for invoice reference and check if narration casing differs from ledger casing (`m = re.search(re.escape(inv_ref), bank_narration, re.IGNORECASE); if m and m.group(0) != inv_ref:`).
- **Alternatives Rejected:** Silently ignoring inverse dates (rejected: invalid in accounting).
- **Files Touched:**
  - `backend/engine/scorer.py`
  - `backend/engine/agents/erp_voucher_agent.py`
  - `backend/engine/audit_exporter.py`
  - `backend/engine/agents/discrepancy_agent.py`
- **Regression Risk:** Medium (modifies scoring output and voucher debit/credit distribution).
- **Verification:**
  - Run `backend/tests/test_voucher_review.py` and `backend/tests/test_action_agents.py` to confirm voucher balancing invariant holds.
  - Add test asserting `precision == 0.0` when zero matches are predicted.

---

## Group 3: Frontend UX, Toast Dispatch & React Hook Correctness (L-30, L-32, L-33, L-34, L-35)
- **Severity:** MEDIUM / STABILITY
- **Root Cause:** Non-standard React patterns (impure render calls, unmemoized hook dependencies, string toast arguments, blocking browser alerts).
- **Industry Standard Fixes:**
  1. **Toast Arguments (L-30):** In `frontend/src/views/AssistantChatView.jsx`, call `onToast({ title: 'Copied', message: 'Copied to clipboard', type: 'info' })`.
  2. **Unmemoized Dependencies (L-33):** In `frontend/src/views/ScenariosView.jsx`, memoize `financialStats` with `useMemo` so `presetScenarios` hook re-evaluates only when underlying transaction amounts change.
  3. **Impure Render (L-32):** In `frontend/src/views/ScenariosView.jsx`, ensure `performance.now()` is called strictly inside event handlers, not in render bodies.
  4. **Blocking Alert (L-34):** In `frontend/src/views/UploadRunView.jsx`, replace `window.alert(...)` with a non-blocking in-page error message or Toast notification.
  5. **Baseline Rules (L-35):** In `frontend/src/views/RulesEngineView.jsx`, provide meaningful baseline default policy rules (e.g., "Auto-Resolve ₹1.00 GST Rounding", "Flag T+3 Clearinghouse Window").
- **Files Touched:**
  - `frontend/src/views/AssistantChatView.jsx`
  - `frontend/src/views/ScenariosView.jsx`
  - `frontend/src/views/UploadRunView.jsx`
  - `frontend/src/views/RulesEngineView.jsx`
- **Regression Risk:** Low (pure frontend reliability improvements).
- **Verification:**
  - Run `npm --prefix frontend run lint` (ensure React compiler warnings are eliminated).
  - Run `npm --prefix frontend run build`.

---

## Group 4: Structured Error Logging & Domain Nomenclature (L-03, L-04, L-13, L-28)
- **Severity:** MEDIUM / OPERATIONAL
- **Root Cause:** Bare exception handlers swallowing diagnostic context and regulatory misnomers.
- **Industry Standard Fixes:**
  1. **Structured Exception Logging (L-13, L-28):** Replace bare `except Exception:` in `backend/routers/reconciliation.py` and `discrepancy_agent.py` with `logger.exception(...)` so stack traces are preserved.
  2. **Domain Nomenclature (L-03, L-04):** Update `schemas.py` and `conformal_verifier.py` docstrings to clarify that the digest is a cryptographic SHA-256 Merkle root result digest and ensure schema field names are clear.
- **Files Touched:**
  - `backend/routers/reconciliation.py`
  - `backend/engine/agents/discrepancy_agent.py`
  - `backend/models/schemas.py`
  - `backend/engine/conformal_verifier.py`
- **Regression Risk:** Very Low.
- **Verification:**
  - Run `pytest backend/tests/test_api.py`.

---

## Group 5: Dead Imports & Static Code Hygiene (L-05, L-07, L-12, L-16, L-17, L-18, L-21, L-23, L-25, L-26)
- **Severity:** LOW / CLEANUP
- **Root Cause:** Codebase evolution left unused imports across modules.
- **Industry Standard Fix:** Remove all unused imports identified by AST analysis.
- **Files Touched:**
  - `backend/engine/conformal_verifier.py`
  - `backend/engine/matcher.py`
  - `backend/engine/agents/discrepancy_agent.py`
  - `backend/engine/agents/narration_parser_agent.py`
  - `backend/engine/agents/decision_maker_agent.py`
  - `backend/engine/agents/erp_voucher_agent.py`
  - `backend/engine/agents/assistant_agent.py`
  - `backend/engine/orchestrator.py`
  - `backend/services/ingestion_service.py`
  - `backend/services/run_service.py`
- **Regression Risk:** Zero.
- **Verification:**
  - Run `scratch/ast_scanner.py` and verify all dead import warnings drop to 0.
  - Run `pytest backend/tests/`.
