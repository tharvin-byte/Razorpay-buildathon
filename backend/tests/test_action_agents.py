import pytest
from backend.engine.data_generator import SyntheticDataGenerator
from backend.engine.orchestrator import ReconciliationOrchestrator
from backend.engine.agents.erp_voucher_agent import ERPVoucherAgent
from backend.engine.agents.bank_dispute_agent import DisputeResolutionBot
from backend.engine.audit_exporter import AuditDossierExporter

@pytest.fixture
def executed_reconciliation():
    gen = SyntheticDataGenerator(seed=42)
    bank_df, ledger_df, settle_df, gt = gen.generate_batch(total_bank_records=50)
    orchestrator = ReconciliationOrchestrator(
        bank_df=bank_df,
        ledger_df=ledger_df,
        settlement_df=settle_df,
        confidence_threshold=0.75,
        ground_truth=gt
    )
    results = orchestrator.run_pipeline()
    summary = orchestrator.get_summary(run_id="test-run-99")
    return summary, results

def test_erp_voucher_agent_balance_invariant(executed_reconciliation):
    """Verify that 100% of generated ERP vouchers strictly satisfy sum(Debit) == sum(Credit)."""
    summary, results = executed_reconciliation
    voucher_resp = ERPVoucherAgent.generate_vouchers_for_run("test-run-99", results)

    assert voucher_resp.total_vouchers > 0
    assert voucher_resp.all_balanced is True
    assert "<VOUCHER" in voucher_resp.tally_batch_xml

    for v in voucher_resp.vouchers:
        assert v.is_balanced is True
        assert abs(v.total_debit - v.total_credit) < 0.01
        assert len(v.entries) >= 2
        assert "DocumentNumber" in v.sap_json_payload

def test_dispute_resolution_bot_evidence_binding(executed_reconciliation):
    """Verify that dispute claims are generated with valid UTRs and Merkle proofs."""
    summary, results = executed_reconciliation
    dispute_resp = DisputeResolutionBot.generate_disputes_for_run("test-run-99", results)

    assert dispute_resp.total_claims > 0
    assert dispute_resp.total_recoverable_capital > 0.0

    for c in dispute_resp.claims:
        assert c.utr_number != ""
        assert len(c.merkle_proof_hash) == 64
        assert "FORMAL NOTICE" in c.formal_letter_text or "COMMERCIAL DISPUTE" in c.formal_letter_text
        assert str(c.disputed_amount) in c.formal_letter_text or f"{c.disputed_amount:,.2f}" in c.formal_letter_text

def test_statutory_audit_dossier_exporter(executed_reconciliation):
    """Verify statutory RBI Form 3CB compliance dossier compilation."""
    summary, results = executed_reconciliation
    dossier = AuditDossierExporter.generate_dossier_for_run(summary, results)

    assert dossier.run_id == "test-run-99"
    assert dossier.clean_match_rate > 0.60
    assert dossier.precision_rate >= 0.95
    assert len(dossier.merkle_root_hash) == 64
    assert dossier.is_solvency_certified is True
    assert "STATUTORY AUDIT & COMPLIANCE DOSSIER" in dossier.full_statutory_text
    assert "FORM 3CB/CD" in dossier.full_statutory_text
