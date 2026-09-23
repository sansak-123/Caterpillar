from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.assistant.service import handle_booking_request, handle_chat, handle_incident_report
from app.db.session import get_db
from app.schemas.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
    BookingRequest,
    BookingResponse,
    IncidentReportRequest,
    IncidentReportResponse,
)

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat", response_model=AssistantChatResponse)
async def chat(
    body: AssistantChatRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> AssistantChatResponse:
    return await handle_chat(session, user, body)


@router.post("/incident", response_model=IncidentReportResponse, status_code=201)
async def report_incident(
    body: IncidentReportRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> IncidentReportResponse:
    return await handle_incident_report(session, user, body)


@router.post("/booking", response_model=BookingResponse, status_code=201)
async def request_booking(
    body: BookingRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> BookingResponse:
    return await handle_booking_request(session, user, body)
