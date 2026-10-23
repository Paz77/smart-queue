from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db import get_session
from app.deps import current_user
from app.logic import history
from app.models import Service, User
from app.models.visit import VisitPublic

router = APIRouter(prefix="/me/history", tags=["history"])


@router.get("", response_model=list[VisitPublic])
def list_history(
    organization_id: str = Query(alias="organizationId"),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    visits = history.list_for_user(session, user.id, organization_id)
    return [
        VisitPublic(
            id=visit.id,
            service_id=visit.service_id,
            service_name=session.get(Service, visit.service_id).name,
            joined_at=visit.joined_at,
            served_at=visit.served_at,
            outcome=visit.outcome,
        )
        for visit in visits
    ]
