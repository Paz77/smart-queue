from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db import get_session
from app.deps import current_user
from app.logic import notifications
from app.models import User
from app.models.notification import NotificationPublic, NotificationRead

router = APIRouter(prefix="/me/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationPublic])
def list_notifications(
    organization_id: str = Query(alias="organizationId"),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    found = notifications.list_for_user(session, user.id, organization_id)
    return [NotificationPublic.model_validate(n) for n in found]


@router.patch("/{notification_id}", response_model=NotificationPublic)
def set_read(
    notification_id: str,
    body: NotificationRead,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    notification = notifications.set_read(session, user.id, notification_id, body.read)
    session.commit()
    session.refresh(notification)
    return NotificationPublic.model_validate(notification)


@router.post("/read-all", status_code=204)
def read_all(
    organization_id: str = Query(alias="organizationId"),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> None:
    notifications.mark_all_read(session, user.id, organization_id)
    session.commit()
