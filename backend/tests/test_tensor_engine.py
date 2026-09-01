"""
Comprehensive Automated Test Suite: Tensor Core, Graph Solver & Conformal Engine
================================================================================
Tests:
1. 3D Hybrid Tensor Engine construction & 5-channel weights
2. Sinkhorn Optimal Transport assignment
3. Bipartite Graph Partitioning (1:1, 1:N, N:1, M:N) and Money Conservation
4. Transaction Lifecycle DAG Netting
5. Conformal Risk Control (CRC) & Merkle Audit Tree
6. End-to-End Multi-Source Reconciliation Pipeline Integration
"""

import pytest
import numpy as np
import pandas as pd
from backend.engine.vector_tensor import HybridTensorEngine, sinkhorn_bipartite_match
from backend.engine.graph_solver import BipartiteGraphSolver, TransactionLifecycleDAG
from backend.engine.conformal_verifier import ConformalRiskVerifier, MerkleAuditTree
from backend.engine.orchestrator import ReconciliationOrchestrator
from backend.engine.data_generator import SyntheticDataGenerator


def test_3d_tensor_construction():
    """Verify 3D Tensor shape [M x N x 5] and composite matrix [M x N]."""
    engine = HybridTensorEngine()
    
    bank_records = [
        {"utr": "UTR123456789", "narration": "UPI/SHREYA/INV1001", "amount": 1000.0, "date": "2026-03-01"},
        {"utr": "UTR998877665", "narration": "NEFT-ROHIT-INV1002", "amount": 2500.0, "date": "2026-03-01"}
    ]
    ledger_records = [
        {"utr": "UTR123456789", "order_id": "ORD1001", "invoice_number": "INV1001", "customer_name": "SHREYA GUPTA", "amount": 1000.0, "date": "2026-03-01"},
        {"utr": "UTR998877665", "order_id": "ORD1002", "invoice_number": "INV1002", "customer_name": "ROHIT VERMA", "amount": 2500.0, "date": "2026-03-01"},
        {"utr": "UTR000000000", "order_id": "ORD1003", "invoice_number": "INV1003", "customer_name": "ANANYA RAO", "amount": 500.0, "date": "2026-03-02"}
    ]

    T, S = engine.build_3d_tensor(bank_records, ledger_records)

    # Validate shapes
    assert T.shape == (2, 3, 5), f"Expected shape (2, 3, 5), got {T.shape}"
    assert S.shape == (2, 3), f"Expected composite shape (2, 3), got {S.shape}"

    # Pair (0, 0) should be a near-perfect match
    assert S[0, 0] > 0.85
    # Channel 0 (UTR) should be 1.0 for pair (0,0) and pair (1,1)
    assert T[0, 0, 0] == 1.0
    assert T[1, 1, 0] == 1.0
    assert T[0, 1, 0] == 0.0


def test_sinkhorn_optimal_transport():
    """Verify Sinkhorn-Knopp assignment returns valid doubly-stochastic probabilities."""
    S = np.array([
        [0.95, 0.20, 0.10],
        [0.15, 0.88, 0.30]
    ])
    P = sinkhorn_bipartite_match(S, reg=0.05, max_iter=15)

    assert P.shape == (2, 3)
    assert np.all(P >= 0.0), "Probabilities must be non-negative"
    assert P[0, 0] > P[0, 1]
    assert P[1, 1] > P[1, 0]


def test_bipartite_graph_partitioning():
    """Verify Connected Component decomposition and Conservation of Money."""
    solver = BipartiteGraphSolver(tolerance=1.00)

    bank_records = [
        {"amount": 25000.0, "utr": "BATCH_PAYOUT_01"},  # Lump settlement
        {"amount": 5000.0, "utr": "UTR_SINGLE"}
    ]
    ledger_records = [
        {"amount": 10000.0, "invoice_number": "INV101"},
        {"amount": 15000.0, "invoice_number": "INV102"},
        {"amount": 5000.0, "invoice_number": "INV103"}
    ]

    # Mock composite matrix where Bank 0 matches Ledger 0 and Ledger 1 (N:1 batch)
    # and Bank 1 matches Ledger 2 (1:1)
    S = np.array([
        [0.85, 0.85, 0.10],
        [0.10, 0.10, 0.95]
    ])

    clusters = solver.partition_and_solve(S, bank_records, ledger_records, threshold=0.70)
    assert len(clusters) >= 2

    # Check N:1 cluster (Bank 0 with Ledger 0 & 1)
    n_to_1_cluster = [c for c in clusters if c.cardinality_type == "N:1"]
    assert len(n_to_1_cluster) == 1
    assert n_to_1_cluster[0].sum_bank == 25000.0
    assert n_to_1_cluster[0].sum_ledger == 25000.0
    assert n_to_1_cluster[0].is_conserved is True


def test_transaction_lifecycle_dag():
    """Verify parent-child partial refund and dispute netting."""
    events = [
        {"type": "ORIGINAL_CHARGE", "amount": 10000.0, "order_id": "ORD_991"},
        {"type": "PARTIAL_REFUND", "amount": 2000.0, "order_id": "ORD_991"},
        {"type": "CHARGEBACK_DEBIT", "amount": 3000.0, "order_id": "ORD_991"}
    ]
    res = TransactionLifecycleDAG.net_order_lifecycle(events)

    assert res["gross_amount"] == 10000.0
    assert res["total_refunds"] == 2000.0
    assert res["total_disputes"] == 3000.0
    assert res["net_obligation"] == 5000.0
    assert res["lifecycle_state"] == "PARTIALLY_REFUNDED"


def test_conformal_risk_and_merkle_tree():
    """Verify Conformal Risk calibration and SHA-256 Merkle root generation."""
    verifier = ConformalRiskVerifier(target_alpha=0.001)

    scores = [0.95, 0.90, 0.85, 0.80, 0.75, 0.60, 0.40]
    labels = [True, True, True, True, True, False, False]

    cal_thresh = verifier.calibrate_threshold(scores, labels)
    assert 0.65 <= cal_thresh <= 0.95

    # Test Merkle Tree
    reconciled = [
        {"bank_id": "B1", "ledger_id": "L1", "amount": 1000.0, "utr": "UTR1", "status": "matched_clean"},
        {"bank_id": "B2", "ledger_id": "L2", "amount": 2000.0, "utr": "UTR2", "status": "matched_clean"}
    ]
    merkle_root = MerkleAuditTree.build_merkle_root(reconciled)
    assert len(merkle_root) == 64  # Valid 256-bit hex digest
    assert isinstance(merkle_root, str)


def test_end_to_end_orchestrator_run():
    """Test full multi-source reconciliation pipeline with synthetic data."""
    gen = SyntheticDataGenerator(seed=42)
    bank_df, ledger_df, settle_df, ground_truth = gen.generate_batch(total_bank_records=50)

    orchestrator = ReconciliationOrchestrator(
        bank_df=bank_df,
        ledger_df=ledger_df,
        settlement_df=settle_df,
        confidence_threshold=0.75,
        ground_truth=ground_truth
    )

    results = orchestrator.run_pipeline()
    assert len(results) > 0

    summary = orchestrator.get_summary()
    assert summary.merkle_root_hash is not None
    assert len(summary.merkle_root_hash) == 64
    assert summary.conformal_calibrated_threshold is not None
    assert summary.match_rate > 0.60
