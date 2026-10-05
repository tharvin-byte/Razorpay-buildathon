import io
import math
from typing import Dict, Any, List, Tuple
import pandas as pd
from backend.engine.data_generator import SyntheticDataGenerator

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_SOURCE_ROWS = 20_000
MAX_SYNTHETIC_BANK_ROWS = 5_000
MAX_FIELD_LENGTH = 4096

SOURCE_REQUIRED_COLUMNS = {
    "bank": {"bank_txn_id", "date", "amount", "narration"},
    "ledger": {
        "ledger_entry_id", "order_id", "merchant_id", "expected_settlement_date",
        "gross_amount", "razorpay_fee", "counterparty_name", "invoice_ref", "status"
    },
    "settlement": {
        "network_settlement_id", "settlement_batch_date", "payment_method",
        "gross_amount", "network_fee", "net_amount", "merchant_order_ref"
    }
}

SOURCE_ID_COLUMNS = {
    "bank": "bank_txn_id",
    "ledger": "ledger_entry_id",
    "settlement": "network_settlement_id"
}


def normalize_uploaded_frame(frame: pd.DataFrame, source: str) -> pd.DataFrame:
    """Validate and normalize an uploaded source before it enters run state."""
    missing = sorted(SOURCE_REQUIRED_COLUMNS[source] - set(frame.columns))
    if missing:
        raise ValueError(f"{source} CSV is missing required columns: {', '.join(missing)}")
    if frame.empty:
        raise ValueError(f"{source} CSV contains no data rows")
    if len(frame) > MAX_SOURCE_ROWS:
        raise ValueError(f"{source} CSV exceeds the {MAX_SOURCE_ROWS} row limit")
    if len(frame.columns) > 100:
        raise ValueError(f"{source} CSV exceeds the 100 column limit")

    clean = frame.copy().fillna("")
    for column in clean.columns:
        too_long = clean[column].astype(str).str.len() > MAX_FIELD_LENGTH
        if too_long.any():
            raise ValueError(f"{source}.{column} exceeds the {MAX_FIELD_LENGTH} character limit")
    id_column = SOURCE_ID_COLUMNS[source]
    clean[id_column] = clean[id_column].astype(str).str.strip()
    if (clean[id_column] == "").any():
        raise ValueError(f"{source}.{id_column} cannot be blank")
    if clean[id_column].duplicated().any():
        duplicates = clean.loc[clean[id_column].duplicated(), id_column].head(5).tolist()
        raise ValueError(f"{source}.{id_column} contains duplicate IDs: {duplicates}")

    date_columns = {
        "bank": ["date"],
        "ledger": ["expected_settlement_date"],
        "settlement": ["settlement_batch_date"]
    }[source]
    for column in date_columns:
        parsed = pd.to_datetime(clean[column], errors="coerce")
        invalid = parsed.isna()
        if invalid.any():
            rows = (invalid[invalid].index[:5] + 2).tolist()
            raise ValueError(f"{source}.{column} has invalid dates at CSV rows {rows}")
        clean[column] = parsed.dt.strftime("%Y-%m-%d")

    numeric_columns = {
        "bank": ["amount"],
        "ledger": ["gross_amount", "razorpay_fee", "refund_amount"],
        "settlement": ["gross_amount", "network_fee", "net_amount"]
    }[source]
    for column in numeric_columns:
        if column not in clean.columns and column == "refund_amount":
            clean[column] = 0.0
        numeric = pd.to_numeric(clean[column], errors="coerce")
        invalid = numeric.isna() | ~numeric.map(lambda value: math.isfinite(float(value)))
        if invalid.any():
            rows = (invalid[invalid].index[:5] + 2).tolist()
            raise ValueError(f"{source}.{column} has invalid numbers at CSV rows {rows}")
        if (numeric < 0).any():
            raise ValueError(f"{source}.{column} cannot contain negative values")
        clean[column] = numeric.astype(float)

    if source == "bank":
        if "type" not in clean.columns:
            clean["type"] = "credit"
        clean["type"] = clean["type"].astype(str).str.strip().str.lower()
        if not clean["type"].isin(["credit", "debit"]).all():
            raise ValueError("bank.type values must be 'credit' or 'debit'")
        if not clean["type"].eq("credit").all():
            raise ValueError("Debit bank rows are not supported by the current reconciliation engine")
        for column in ("counterparty_account", "narration", "utr_number"):
            if column not in clean.columns:
                clean[column] = ""
    elif source == "ledger":
        if "refund_amount" not in frame.columns:
            clean["refund_amount"] = 0.0
        clean["status"] = clean["status"].astype(str).str.strip().str.lower()
        if not clean["status"].isin(["pending", "settled", "failed"]).all():
            raise ValueError("ledger.status values must be pending, settled, or failed")
        if "utr_number" not in clean.columns:
            clean["utr_number"] = ""
    else:
        if "utr_number" not in clean.columns:
            clean["utr_number"] = ""
    currency_columns = [c for c in ("currency", "currency_code") if c in clean.columns]
    for column in currency_columns:
        if not clean[column].astype(str).str.strip().str.upper().isin(["INR"]).all():
            raise ValueError(f"{source}.{column} supports INR only")
    return clean


def generate_synthetic_run(
    records_count: int = 70,
    seed: int = 42
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, List[Dict[str, Any]]]:
    """Generates synthetic test batch frames and ground truth."""
    gen = SyntheticDataGenerator(seed=seed)
    return gen.generate_batch(total_bank_records=records_count)
