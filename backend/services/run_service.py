import logging
from datetime import datetime
from typing import Any, Optional, List

from backend.models.schemas import SummaryResponse
from backend.engine.data_generator import SyntheticDataGenerator
from backend.engine.orchestrator import ReconciliationOrchestrator
from backend.services.run_repository import RunSession, InMemoryRunRepository

logger = logging.getLogger("reconx.services.run")

_repo = InMemoryRunRepository()


class RunStore:
    def __init__(self, repo: InMemoryRunRepository):
        self._repo = repo

    def __getitem__(self, key: str) -> RunSession:
        if key == "demo-run-001" and key not in self._repo:
            init_default_demo_run()
        return self._repo[key]

    def __setitem__(self, key: str, session: RunSession) -> None:
        self._repo.save(session)

    def __contains__(self, key: str) -> bool:
        return key in self._repo

    def get(self, key: str, default: Any = None) -> Optional[RunSession]:
        if key == "demo-run-001" and key not in self._repo:
            init_default_demo_run()
        return self._repo.get(key, default)

    def keys(self):
        return self._repo.keys()

    def values(self):
        return self._repo.values()

    def items(self):
        return self._repo.items()

    def __iter__(self):
        return iter(self._repo)

    def __len__(self):
        return len(self._repo)


RUNS: RunStore = RunStore(_repo)


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
