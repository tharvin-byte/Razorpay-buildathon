import logging
import threading
from datetime import datetime
from typing import Dict, Any, Optional, List
import pandas as pd

from backend.models.schemas import (
    ReconciliationResult, SummaryResponse
)
from backend.engine.data_generator import SyntheticDataGenerator
from backend.engine.orchestrator import ReconciliationOrchestrator
from backend.engine.agents.assistant_agent import ReconciliationAssistant

logger = logging.getLogger("reconx.services.run")


class RunSession:
    def __init__(self, run_id: str):
        self.run_id = run_id
        now = datetime.now()
        self.created_at = now.isoformat()
        self.created_at_dt = now
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.status = "idle"  # idle, uploading, running, completed, failed
        self.processed = 0
        self.total = 0
        self.current_agent = "Initialized"
        self.current_record = ""
        self.error = None

        self.bank_df: Optional[pd.DataFrame] = None
        self.ledger_df: Optional[pd.DataFrame] = None
        self.settlement_df: Optional[pd.DataFrame] = None
        self.ground_truth: Optional[List[Dict[str, Any]]] = None

        self.confidence_threshold: float = 0.75
        self.orchestrator: Optional[ReconciliationOrchestrator] = None
        self.results: List[ReconciliationResult] = []
        self.summary: Optional[SummaryResponse] = None
        self.assistant = ReconciliationAssistant()
        self.operation_lock = threading.Lock()
        self.sweep_points = None


class RunStore(dict):
    def __getitem__(self, key):
        if key == "demo-run-001" and key not in self:
            init_default_demo_run()
        return super().__getitem__(key)

    def get(self, key, default=None):
        if key == "demo-run-001" and key not in self:
            init_default_demo_run()
        return super().get(key, default)


RUNS: Dict[str, RunSession] = RunStore()


def get_session(run_id: str) -> Optional[RunSession]:
    """Retrieves a session from the in-memory store."""
    return RUNS.get(run_id)


def create_session(run_id: str) -> RunSession:
    """Creates and stores a new run session."""
    session = RunSession(run_id)
    RUNS[run_id] = session
    return session


def list_active_runs() -> List[str]:
    """Returns all active run IDs."""
    if "demo-run-001" not in RUNS:
        init_default_demo_run()
    return list(RUNS.keys())


def init_default_demo_run(force: bool = False):
    """Initializes the default demo run (demo-run-001) with synthetic data."""
    demo_id = "demo-run-001"
    if demo_id in RUNS and not force:
        return RUNS[demo_id]

    session = RunSession(demo_id)
    session.started_at = datetime.now()
    gen = SyntheticDataGenerator(seed=42)
    df_bank, df_ledger, df_settle, gt = gen.generate_batch(total_bank_records=70)
    session.bank_df = df_bank
    session.ledger_df = df_ledger
    session.settlement_df = df_settle
    session.ground_truth = gt

    session.status = "running"
    session.orchestrator = ReconciliationOrchestrator(
        bank_df=df_bank,
        ledger_df=df_ledger,
        settlement_df=df_settle,
        confidence_threshold=0.75,
        ground_truth=gt
    )
    session.results = session.orchestrator.run_pipeline()
    session.summary = session.orchestrator.get_summary(run_id=demo_id)
    session.status = "completed"
    session.completed_at = datetime.now()
    session.processed = len(df_bank)
    session.total = len(df_bank)
    session.current_agent = "Completed"
    RUNS[demo_id] = session
    return session


def execute_pipeline_task(run_id: str, threshold: float):
    """Executes the reconciliation pipeline asynchronously as a background task."""
    session = RUNS.get(run_id)
    if not session:
        return

    session.status = "running"
    session.started_at = datetime.now()
    session.confidence_threshold = threshold

    def progress_callback(processed: int, total: int, agent: str, rec_id: str):
        session.processed = processed
        session.total = total
        session.current_agent = agent
        session.current_record = rec_id

    try:
        session.orchestrator = ReconciliationOrchestrator(
            bank_df=session.bank_df,
            ledger_df=session.ledger_df,
            settlement_df=session.settlement_df,
            confidence_threshold=threshold,
            ground_truth=session.ground_truth
        )
        session.results = session.orchestrator.run_pipeline(progress_callback=progress_callback)
        session.summary = session.orchestrator.get_summary(run_id=run_id)
        session.completed_at = datetime.now()
        session.status = "completed"
        session.current_agent = "Completed"
    except Exception:
        logger.exception("Reconciliation pipeline failed for run_id=%s", run_id)
        with session.operation_lock:
            session.completed_at = datetime.now()
            session.status = "failed"
            session.error = "Reconciliation failed. Check server logs for details."


def recompute_run(run_id: str, threshold: float) -> SummaryResponse:
    """Recomputes reconciliation threshold under operation lock."""
    session = RUNS.get(run_id)
    if not session or session.bank_df is None:
        raise ValueError("Run session not found")

    with session.operation_lock:
        if session.status == "running":
            raise RuntimeError("A reconciliation operation is already running")
        session.status = "running"
        session.sweep_points = None

    try:
        orchestrator = ReconciliationOrchestrator(
            bank_df=session.bank_df,
            ledger_df=session.ledger_df,
            settlement_df=session.settlement_df,
            confidence_threshold=threshold,
            ground_truth=session.ground_truth
        )
        results = orchestrator.run_pipeline()
        summary = orchestrator.get_summary(run_id=run_id)
        with session.operation_lock:
            session.confidence_threshold = threshold
            session.started_at = datetime.now()
            session.orchestrator = orchestrator
            session.results = results
            session.summary = summary
            session.completed_at = datetime.now()
            session.status = "completed"
            session.current_agent = "Completed"
        return summary
    except Exception:
        logger.exception("Threshold recompute failed for run_id=%s", run_id)
        with session.operation_lock:
            session.status = "failed"
            session.error = "Threshold recompute failed. Check server logs for details."
            session.completed_at = datetime.now()
        raise
