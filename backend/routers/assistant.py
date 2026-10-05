from fastapi import APIRouter, HTTPException

from backend.models.schemas import ChatRequest, ChatResponse
from backend.services.run_service import get_session

router = APIRouter(tags=["Assistant Copilot"])


@router.post("/chat", response_model=ChatResponse)
def chat_assistant(req: ChatRequest):
    session = get_session(req.run_id)
    if not session:
        raise HTTPException(status_code=404, detail="Run session not found")
    if session.status != "completed" or not session.summary:
        raise HTTPException(status_code=409, detail="Run must be completed before asking questions")

    if not session.summary and session.results and session.orchestrator:
        session.summary = session.orchestrator.get_summary(run_id=req.run_id)

    answer, relevant_ids = session.assistant.answer_query(
        question=req.question,
        summary=session.summary,
        results=session.results
    )

    return ChatResponse(
        answer=answer,
        relevant_record_ids=relevant_ids,
        confidence=0.0,
        confidence_available=False
    )
