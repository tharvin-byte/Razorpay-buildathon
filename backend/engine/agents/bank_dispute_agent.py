from typing import List

from backend.models.schemas import DisputeListResponse, ReconciliationResult


class DisputeResolutionBot:
    """Compatibility endpoint that abstains until dispute rules are validated."""

    @classmethod
    def generate_disputes_for_run(
        cls,
        run_id: str,
        results: List[ReconciliationResult],
    ) -> DisputeListResponse:
        # The repository has no verified contracts or regulatory rule set from
        # which to derive a legal claim or recovery amount.
        return DisputeListResponse(
            run_id=run_id,
            total_claims=0,
            total_recoverable_capital=0.0,
            claims=[],
        )


BankDisputeAgent = DisputeResolutionBot