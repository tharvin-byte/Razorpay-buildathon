import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_full_system_live_integration():
    """Verify in-memory end-to-end integration between backend APIs and data contracts."""
    
    # 1. Health check
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert "version" in data

    # 2. ERP Vouchers API
    res = client.get("/run/demo-run-001/erp-vouchers")
    assert res.status_code == 200
    erp_data = res.json()
    assert erp_data["run_id"] == "demo-run-001"
    assert erp_data["total_vouchers"] > 0
    assert erp_data["all_balanced"] is True
    assert erp_data["total_adjustable_amount"] > 0
    
    # Verify voucher schema integrity
    first_voucher = erp_data["vouchers"][0]
    assert "voucher_id" in first_voucher
    assert "entries" in first_voucher
    assert len(first_voucher["entries"]) >= 2
    assert "tally_xml_payload" in first_voucher
    assert "<VOUCHER" in first_voucher["tally_xml_payload"]
    assert first_voucher["is_balanced"] is True

    # 3. Tally XML Download
    res = client.get("/run/demo-run-001/erp-vouchers/tally-xml")
    assert res.status_code == 200
    xml_content = res.text
    assert "<ENVELOPE>" in xml_content
    assert "<TALLYMESSAGE" in xml_content

    # 4. Bank Disputes & Claims API
    res = client.get("/run/demo-run-001/disputes")
    assert res.status_code == 200
    dispute_data = res.json()
    assert dispute_data["run_id"] == "demo-run-001"
    assert dispute_data["total_claims"] > 0
    assert dispute_data["total_recoverable_capital"] > 0
    
    # Verify claim schema integrity
    first_claim = dispute_data["claims"][0]
    assert "claim_id" in first_claim
    assert "utr_number" in first_claim
    assert "disputed_amount" in first_claim
    assert "npci_reason_code" in first_claim
    assert "formal_letter_text" in first_claim
    assert "merkle_proof_hash" in first_claim
    assert len(first_claim["merkle_proof_hash"]) == 64  # SHA-256

    # 5. Statutory Audit Dossier API
    res = client.get("/run/demo-run-001/statutory-dossier")
    assert res.status_code == 200
    dossier_data = res.json()
    assert dossier_data["run_id"] == "demo-run-001"
    assert dossier_data["merkle_root_hash"] is not None
    assert len(dossier_data["merkle_root_hash"]) == 64
    assert "STATUTORY AUDIT & COMPLIANCE DOSSIER" in dossier_data["full_statutory_text"]
