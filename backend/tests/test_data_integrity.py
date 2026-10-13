import json
from pathlib import Path

from backend.engine.data_generator import SyntheticDataGenerator


ROOT = Path(__file__).resolve().parents[2]


def test_synthetic_generation_is_reproducible_and_does_not_depend_on_global_rng():
    import random

    random.seed(811)
    before = random.getstate()
    generated_a = SyntheticDataGenerator(seed=17).generate_batch(total_bank_records=24)
    assert random.getstate() == before
    generated_b = SyntheticDataGenerator(seed=17).generate_batch(total_bank_records=24)

    for left, right in zip(generated_a[:3], generated_b[:3]):
        assert left.equals(right)
    assert generated_a[3] == generated_b[3]


def test_checked_in_ground_truth_settlement_reference_gaps_are_reported_without_rewriting():
    gt_path = ROOT / "data" / "ground_truth.json"
    settlement_path = ROOT / "data" / "settlement_report.csv"
    ground_truth = json.loads(gt_path.read_text(encoding="utf-8"))
    settlement_ids = {
        line.split(",", 1)[0]
        for line in settlement_path.read_text(encoding="utf-8-sig").splitlines()[1:]
    }
    unresolved = [
        (entry["bank_txn_id"], entry["settlement_id"])
        for entry in ground_truth
        if entry.get("settlement_id") and entry["settlement_id"] not in settlement_ids
    ]

    assert unresolved == [
        ("BNK-20260305-1055", "NPCI-SET-01055"),
        ("BNK-20260304-1059", "NPCI-SET-01059"),
        ("BNK-20260303-1060", "NPCI-SET-01060"),
        ("BNK-20260304-1061", "NPCI-SET-01061"),
        ("BNK-20260301-1062", "NPCI-SET-01062"),
        ("BNK-20260302-1063", "NPCI-SET-01063"),
        ("BNK-20260304-1064", "NPCI-SET-01064"),
        ("BNK-20260304-1065", "NPCI-SET-01065"),
    ]
