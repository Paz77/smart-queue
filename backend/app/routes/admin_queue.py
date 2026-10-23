"""Admin queue endpoints. Thin wrappers around the queue engine.

Every change returns the updated line, so the Queue Management screen can redraw
from one response.
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.deps import current_user, require_admin
from app.logic import queue_engine, services
from app.models import QueueEntry, Service, User
from app.models.service import AdminQueue, QueueEntryUpdate

router = APIRouter(prefix="/admin", tags=["admin queue"])


def admin_service(session: Session, service_id: str, user: User) -> Service:
    service = services.get_service(session, service_id)
    require_admin(service.organization_id, user)
    return service


def admin_entry(session: Session, entry_id: str, user: User) -> tuple[QueueEntry, Service]:
    entry = services.get_entry(session, entry_id)
    service = admin_service(session, entry.service_id, user)
    return entry, service


@router.get("/services/{service_id}/queue", response_model=AdminQueue)
def view_line(
    service_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    service = admin_service(session, service_id, user)
    return services.admin_queue(session, service)


@router.post("/services/{service_id}/serve-next", response_model=AdminQueue)
def serve_next(
    service_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    service = admin_service(session, service_id, user)
    queue_engine.serve_next(session, service)
    session.commit()
    return services.admin_queue(session, service)


@router.patch("/queue-entries/{entry_id}", response_model=AdminQueue)
def update_entry(
    entry_id: str,
    body: QueueEntryUpdate,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    entry, service = admin_entry(session, entry_id, user)
    # Priority first, so a position sent with it is where the person ends up.
    if body.priority is not None:
        queue_engine.set_priority(session, entry, body.priority)
    if body.position is not None:
        queue_engine.move(session, entry, body.position)
    session.commit()
    return services.admin_queue(session, service)


@router.delete("/queue-entries/{entry_id}", response_model=AdminQueue)
def remove_entry(
    entry_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    entry, service = admin_entry(session, entry_id, user)
    queue_engine.remove(session, entry)
    session.commit()
    return services.admin_queue(session, service)
