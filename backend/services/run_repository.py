import os
import threading
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Iterator
import pandas as pd

from backend.models.schemas import (
    ReconciliationResult, SummaryResponse
)
from backend.engine.orchestrator import ReconciliationOrchestrator
from backend.engine.agents.assistant_agent import ReconciliationAssistant

logger = logging.getLogger("reconx.services.repository")


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


class AbstractRunRepository(ABC):
    """Abstract port for run persistence and retrieval."""

    @abstractmethod
    def get(self, run_id: str) -> Optional[RunSession]:
        pass

    @abstractmethod
    def save(self, session: RunSession) -> None:
        pass

    @abstractmethod
    def delete(self, run_id: str) -> bool:
        pass

    @abstractmethod
    def list_ids(self) -> List[str]:
        pass


class InMemoryRunRepository(AbstractRunRepository):
    """
    In-memory run repository with capacity bounds and TTL-based eviction.
    Protects 'demo-run-001' from being evicted.
    Exposes dictionary compatibility methods (__getitem__, __setitem__, etc.).
    """

    def __init__(self, max_runs: Optional[int] = None, ttl_seconds: Optional[int] = None):
        self.max_runs = max_runs or int(os.environ.get("RECONX_MAX_RUNS", "50"))
        self.ttl_seconds = ttl_seconds or int(os.environ.get("RECONX_RUN_TTL_SECONDS", "86400"))
        self._store: Dict[str, RunSession] = {}
        self._lock = threading.Lock()

    def get(self, run_id: str, default: Any = None) -> Optional[RunSession]:
        with self._lock:
            self._evict_stale()
            session = self._store.get(run_id)
            if session is None and run_id == "demo-run-001":
                return None  # Will be lazily initialized by caller
            return session if session is not None else default

    def save(self, session: RunSession) -> None:
        with self._lock:
            self._evict_stale()
            # If over capacity, evict oldest completed runs
            if len(self._store) >= self.max_runs and session.run_id not in self._store:
                self._evict_oldest()
            self._store[session.run_id] = session

    def delete(self, run_id: str) -> bool:
        with self._lock:
            if run_id in self._store:
                del self._store[run_id]
                return True
            return False

    def list_ids(self) -> List[str]:
        with self._lock:
            self._evict_stale()
            return list(self._store.keys())

    def _evict_stale(self) -> None:
        """Evicts runs exceeding TTL (except demo-run-001)."""
        now = datetime.now()
        ttl_delta = timedelta(seconds=self.ttl_seconds)
        to_remove = []
        for rid, sess in self._store.items():
            if rid == "demo-run-001":
                continue
            if now - sess.created_at_dt > ttl_delta and sess.status != "running":
                to_remove.append(rid)
        for rid in to_remove:
            logger.info("Evicting stale run_id=%s past TTL", rid)
            del self._store[rid]

    def _evict_oldest(self) -> None:
        """Evicts the oldest finished run to preserve memory bounds."""
        candidates = [
            (sess.created_at_dt, rid)
            for rid, sess in self._store.items()
            if rid != "demo-run-001" and sess.status in ("completed", "failed", "idle")
        ]
        if candidates:
            candidates.sort()
            oldest_id = candidates[0][1]
            logger.info("Evicting oldest run_id=%s to respect max_runs=%d limit", oldest_id, self.max_runs)
            del self._store[oldest_id]

    # --- Dictionary protocol compatibility ---
    def __getitem__(self, run_id: str) -> RunSession:
        val = self.get(run_id)
        if val is None:
            raise KeyError(run_id)
        return val

    def __setitem__(self, run_id: str, session: RunSession) -> None:
        self.save(session)

    def __contains__(self, run_id: str) -> bool:
        with self._lock:
            return run_id in self._store

    def __len__(self) -> int:
        with self._lock:
            return len(self._store)

    def __iter__(self) -> Iterator[str]:
        with self._lock:
            return iter(list(self._store.keys()))

    def keys(self):
        with self._lock:
            return self._store.keys()

    def values(self):
        with self._lock:
            return self._store.values()

    def items(self):
        with self._lock:
            return self._store.items()
