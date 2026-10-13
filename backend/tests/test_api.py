import pytest
import pandas as pd
from fastapi.testclient import TestClient
from backend.main import app, RUNS, _normalize_uploaded_frame, _escape_csv_formula_value

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["app"] == "ReconX Multi-Source Reconciliation Agent"
    assert "demo-run-001" in data["active_runs"]

def test_demo_run_summary():
    response = client.get("/run/demo-run-001/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["run_id"] == "demo-run-001"
    assert data["total_bank_records"] == 70
    assert data["match_rate"] > 0.70
    assert data["matched_clean_count"] > 0
    assert data["exception_ledger_count"] > 0
    assert data["bank_matched_records"] <= data["total_bank_records"]
    assert data["ledger_coverage_rate"] == pytest.approx(
        data["matched_ledger_records"] / data["eligible_ledger_records"],
        abs=1e-4
    )
    assert data["overall_resolution_rate"] == pytest.approx(
        data["resolved_result_records"] / data["total_result_records"],
        abs=1e-4
    )

def test_demo_run_transactions():
    response = client.get("/run/demo-run-001/transactions")
    assert response.status_code == 200
    txns = response.json()
    assert len(txns) >= 70
    
    # Test single transaction detail
    first_id = txns[0]["record_id"]
    detail_res = client.get(f"/run/demo-run-001/transaction/{first_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["record_id"] == first_id

    trace_res = client.get(f"/run/demo-run-001/trace/{first_id}")
    assert trace_res.status_code == 200
    trace_data = trace_res.json()
    assert trace_data["trace"] == detail["trace"]
    assert trace_data["trace_available"] is bool(detail["trace"])


def test_transactions_pagination():
    res_full = client.get("/run/demo-run-001/transactions")
    assert res_full.status_code == 200
    full_count = len(res_full.json())

    res_paged = client.get("/run/demo-run-001/transactions?limit=10&offset=0")
    assert res_paged.status_code == 200
    paged = res_paged.json()
    assert len(paged) == 10
    assert paged[0]["record_id"] == res_full.json()[0]["record_id"]

    res_offset = client.get("/run/demo-run-001/transactions?limit=5&offset=10")
    assert res_offset.status_code == 200
    assert len(res_offset.json()) == 5
    assert res_offset.json()[0]["record_id"] == res_full.json()[10]["record_id"]


def test_trace_endpoint_explicitly_reports_missing_recorded_trace():
    session = RUNS["demo-run-001"]
    result = session.results[0]
    original = result.trace
    try:
        result.trace = []
        response = client.get(f"/run/demo-run-001/trace/{result.record_id}")
        assert response.status_code == 200
        assert response.json()["trace_available"] is False
        assert response.json()["trace"] == []
    finally:
        result.trace = original

def test_demo_run_discrepancies_and_exceptions():
    disc_res = client.get("/run/demo-run-001/discrepancies")
    assert disc_res.status_code == 200
    assert len(disc_res.json()) > 0
    
    exc_res = client.get("/run/demo-run-001/exceptions")
    assert exc_res.status_code == 200
    assert len(exc_res.json()) > 0

def test_threshold_recompute():
    recomp_res = client.post("/run/demo-run-001/recompute", json={"threshold": 0.85})
    assert recomp_res.status_code == 200
    data = recomp_res.json()
    assert data["current_threshold"] == 0.85


def test_start_and_recompute_reject_duplicate_running_operation():
    session = RUNS["demo-run-001"]
    old_status = session.status
    try:
        with session.operation_lock:
            session.status = "running"
        assert client.post("/run/demo-run-001").status_code == 409
        assert client.post("/run/demo-run-001/recompute", json={"threshold": 0.8}).status_code == 409
        assert client.get("/run/demo-run-001/status").json()["status"] == "running"
    finally:
        with session.operation_lock:
            session.status = old_status

def test_chat_assistant():
    chat_res = client.post("/chat", json={"run_id": "demo-run-001", "question": "How many ledger orphans were detected?"})
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert "answer" in data
    assert len(data["answer"]) > 10

def test_report_export():
    rep_res = client.get("/run/demo-run-001/report")
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert "executive_summary" in rep_data
    
    dl_res = client.get("/run/demo-run-001/report/download?format=csv")
    assert dl_res.status_code == 200
    assert "text/csv" in dl_res.headers["content-type"]


def test_upload_requires_bank_and_ledger_sources():
    response = client.post(
        "/upload",
        files={"settlement_file": ("settlement.csv", b"network_settlement_id\nS1\n", "text/csv")},
        data={},
    )
    assert response.status_code == 503
    assert "authenticated access" in response.json()["detail"]


def test_upload_validates_required_columns_before_creating_run():
    response = client.post(
        "/upload",
        files={
            "bank_file": ("bank.csv", b"bank_txn_id,date,amount,narration\nB1,2026-03-01,10,UPI/INV1\n", "text/csv"),
            "ledger_file": ("ledger.csv", b"ledger_entry_id\nL1\n", "text/csv"),
        },
        data={},
    )
    assert response.status_code == 503
    assert "authenticated access" in response.json()["detail"]


def test_recompute_threshold_is_range_validated():
    response = client.post("/run/demo-run-001/recompute", json={"threshold": 1.5})
    assert response.status_code == 422


def test_upload_normalizer_validates_ids_dates_amount_and_type():
    bank = pd.DataFrame([{
        "bank_txn_id": "B1", "date": "2026-03-01", "amount": "12.50",
        "narration": "UPI/INV1", "type": "credit"
    }])
    normalized = _normalize_uploaded_frame(bank, "bank")
    assert normalized.loc[0, "amount"] == 12.5
    assert normalized.loc[0, "utr_number"] == ""

    with pytest.raises(ValueError, match="duplicate IDs"):
        _normalize_uploaded_frame(pd.concat([bank, bank]), "bank")
    with pytest.raises(ValueError, match="invalid dates"):
        _normalize_uploaded_frame(bank.assign(date="not-a-date"), "bank")
    with pytest.raises(ValueError, match="negative values"):
        _normalize_uploaded_frame(bank.assign(amount=-1), "bank")
    with pytest.raises(ValueError, match="not supported"):
        _normalize_uploaded_frame(bank.assign(type="debit"), "bank")


def test_upload_normalizer_rejects_non_inr_when_currency_is_supplied():
    bank = pd.DataFrame([{
        "bank_txn_id": "B1", "date": "2026-03-01", "amount": 12.5,
        "narration": "UPI/INV1", "currency": "USD"
    }])
    with pytest.raises(ValueError, match="supports INR only"):
        _normalize_uploaded_frame(bank, "bank")


def test_csv_formula_escaping_only_changes_formula_leading_strings():
    assert _escape_csv_formula_value("=HYPERLINK(\"x\")") == "'=HYPERLINK(\"x\")"
    assert _escape_csv_formula_value("  +1+1") == "'  +1+1"
    assert _escape_csv_formula_value("normal") == "normal"
    assert _escape_csv_formula_value(12.5) == 12.5


def test_csv_download_escapes_formula_text_without_changing_json_values():
    session = RUNS["demo-run-001"]
    result = session.results[0]
    original = result.explanation
    try:
        result.explanation = "=1+1"
        csv_response = client.get("/run/demo-run-001/report/download?format=csv")
        assert csv_response.status_code == 200
        assert "'=1+1" in csv_response.text

        transaction_response = client.get(f"/run/demo-run-001/transaction/{result.record_id}")
        assert transaction_response.status_code == 200
        assert transaction_response.json()["explanation"] == "=1+1"
    finally:
        result.explanation = original
