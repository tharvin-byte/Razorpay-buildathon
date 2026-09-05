from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import date

# ==========================================
# Input Data Models
# ==========================================

class BankRecord(BaseModel):
    bank_txn_id: str
    date: str
    amount: float
    type: Literal["credit", "debit"]
    counterparty_account: str
    narration: str
    utr_number: Optional[str] = None

class LedgerRecord(BaseModel):
    ledger_entry_id: str
    order_id: str
    merchant_id: str
    expected_settlement_date: str
    gross_amount: float
    razorpay_fee: float
    refund_amount: float = 0.0
    counterparty_name: str
    invoice_ref: str
    status: Literal["pending", "settled", "failed"]

class SettlementRecord(BaseModel):
    network_settlement_id: str
    settlement_batch_date: str
    payment_method: str
    gross_amount: float
    network_fee: float
    net_amount: float
    merchant_order_ref: str
    utr_number: Optional[str] = None

# ==========================================
# Engine Scoring & Discrepancy Models
# ==========================================

class SignalBreakdown(BaseModel):
    utr_match: float = 0.0
    invoice_ref_match: float = 0.0
    counterparty_name_sim: float = 0.0
    amount_match: float = 0.0
    date_proximity: float = 0.0
    fx_tolerance_score: float = 1.0
    total_score: float = 0.0
    merkle_leaf_hash: Optional[str] = None
    cardinality_type: Optional[str] = "1:1"
    details: Dict[str, Any] = Field(default_factory=dict)

class DiscrepancyDetail(BaseModel):
    type: Literal[
        "fee_deduction",
        "timing_lag",
        "partial_refund",
        "rounding_difference",
        "batch_settlement",
        "reference_formatting",
        "duplicate_retry",
        "unreconciled_amount_gap",
        "status_mismatch",
        "none"
    ]
    description: str
    impact_amount: Optional[float] = None
    days_lag: Optional[int] = None

class AgentTraceStep(BaseModel):
    step_num: int
    agent_name: str
    action: str
    input_summary: str
    output_summary: str
    reasoning: Optional[str] = None
    timestamp: Optional[str] = None
    duration_ms: Optional[float] = None
    tools_called: Optional[List[str]] = Field(default_factory=list)
    step_hash: Optional[str] = None
    status: Optional[str] = "COMPLETED"

class ReconciliationResult(BaseModel):
    record_id: str # bank_txn_id or ledger_entry_id for reverse sweep
    source_type: Literal["bank", "ledger", "batch"]
    bank_record: Optional[BankRecord] = None
    matched_ledger_record: Optional[LedgerRecord] = None
    matched_settlement_record: Optional[SettlementRecord] = None
    matched_ledger_ids: Optional[List[str]] = None # For Phase C batch settlement
    
    status: Literal["matched_clean", "matched_with_discrepancy", "exception", "expected_non_match"]
    confidence_score: float
    signals: SignalBreakdown
    
    discrepancies: List[DiscrepancyDetail] = Field(default_factory=list)
    explanation: str
    
    exception_side: Optional[Literal["bank", "ledger", "both"]] = None
    exception_reason: Optional[str] = None
    
    trace: List[AgentTraceStep] = Field(default_factory=list)

# ==========================================
# Ground Truth Models (Hidden from Agents)
# ==========================================

class GroundTruthEntry(BaseModel):
    bank_txn_id: Optional[str] = None
    ledger_entry_ids: List[str] = Field(default_factory=list)
    settlement_id: Optional[str] = None
    expected_status: Literal["matched_clean", "matched_with_discrepancy", "exception", "expected_non_match"]
    expected_discrepancies: List[str] = Field(default_factory=list)
    is_orphan: bool = False
    orphan_side: Optional[str] = None
    notes: Optional[str] = None

# ==========================================
# Evaluation & Summary Models
# ==========================================

class EvaluationMetrics(BaseModel):
    total_records: int
    matched_count: int
    discrepancy_count: int
    exception_count: int
    expected_non_match_count: int
    
    match_rate: float
    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float
    exception_accuracy: float
    
    ground_truth_total_matches: int
    correct_matches: int
    false_positives: int
    false_negatives: int
    correct_exceptions: int

class ThresholdSweepPoint(BaseModel):
    threshold: float
    precision: float
    recall: float
    f1_score: float
    match_rate: float
    false_positive_rate: float
    matched_count: int
    exception_count: int

class SummaryResponse(BaseModel):
    run_id: str
    total_bank_records: int
    total_ledger_records: int
    total_settlement_records: int
    
    matched_clean_count: int
    matched_discrepancy_count: int
    exception_bank_count: int
    exception_ledger_count: int
    expected_non_match_count: int
    
    match_rate: float
    discrepancy_breakdown: Dict[str, int]
    current_threshold: float
    merkle_root_hash: Optional[str] = None
    conformal_calibrated_threshold: Optional[float] = None
    evaluation: Optional[EvaluationMetrics] = None

# ==========================================
# API Request / Response Models
# ==========================================

class RunStatusResponse(BaseModel):
    run_id: str
    status: Literal["idle", "uploading", "running", "completed", "failed"]
    processed: int
    total: int
    current_agent: Optional[str] = None
    current_record: Optional[str] = None
    error: Optional[str] = None

class ChatRequest(BaseModel):
    run_id: str
    question: str

class ChatResponse(BaseModel):
    answer: str
    relevant_record_ids: List[str] = Field(default_factory=list)
    confidence: float = 1.0

class RecomputeRequest(BaseModel):
    threshold: float

# ==========================================
# Autonomous Action Suite Schemas
# ==========================================

class ERPAccountEntry(BaseModel):
    account_code: str
    account_name: str
    debit_amount: float = 0.0
    credit_amount: float = 0.0
    narration: str

class ERPVoucher(BaseModel):
    voucher_id: str
    voucher_type: str = "Journal"
    voucher_date: str
    reference_txn_id: str
    utr_number: Optional[str] = None
    counterparty_name: str
    entries: List[ERPAccountEntry]
    total_debit: float
    total_credit: float
    is_balanced: bool
    tally_xml_payload: str
    sap_json_payload: Dict[str, Any]
    adjustment_reason: str

class ERPVoucherResponse(BaseModel):
    run_id: str
    total_vouchers: int
    total_adjustable_amount: float
    all_balanced: bool
    vouchers: List[ERPVoucher]
    tally_batch_xml: str

class DisputeClaim(BaseModel):
    claim_id: str
    transaction_id: str
    utr_number: str
    bank_name: str
    claim_type: str
    disputed_amount: float
    expected_amount: float
    actual_amount: float
    claim_status: Literal["drafted", "submitted", "adjudicated", "recovered"]
    npci_reason_code: str
    merkle_proof_hash: str
    formal_letter_text: str
    created_at: str
    counterparty_name: Optional[str] = None

class DisputeListResponse(BaseModel):
    run_id: str
    total_claims: int
    total_recoverable_capital: float
    claims: List[DisputeClaim]

class StatutoryAuditDossier(BaseModel):
    run_id: str
    attestation_date: str
    financial_year: str
    nodal_escrow_account: str
    total_settlement_volume: float
    clean_match_rate: float
    precision_rate: float
    total_discrepancies: int
    total_exceptions: int
    merkle_root_hash: str
    is_solvency_certified: bool
    form_3cb_schedule: Dict[str, Any]
    full_statutory_text: str

