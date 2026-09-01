import pytest
from fastapi.testclient import TestClient
from backend.main import app

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
