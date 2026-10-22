from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db import get_session
from app.deps import current_user
from app.errors import ApiError
from app.logic import queue_engine, wait_time
from app.models import Organization, QueueEntry, Service, User
from app.models.queue_entry import QueueEntryPublic, QueueJoin, QueueLine, QueueSpot

router = APIRouter(tags=["queue"])


def find_service(session: Session, service_id: str) -> Service:
    service = session.get(Service, service_id)
    if service is None:
        raise ApiError(404, "not_found", "Service not found.")
    return service


def check_organization(session: Session, organization_id: str) -> None:
    if session.get(Organization, organization_id) is None:
        raise ApiError(404, "not_found", "Organization not found.")


def entry_out(session: Session, entry: QueueEntry) -> QueueEntryPublic:
    service = session.get(Service, entry.service_id)
    wait = wait_time.estimate_wait(entry.position, service)
    return QueueEntryPublic.model_validate(entry, update={"estimated_wait": wait})


@router.get("/services/{service_id}/queue", response_model=QueueLine)
def view_line(
    service_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    service = find_service(session, service_id)
    current = queue_engine.line(session, service.id)
    normal_position = queue_engine.join_position(current, "normal")
    priority_position = queue_engine.join_position(current, "priority")
    spots = [QueueSpot(id=e.id, position=e.position, status=e.status, is_me=e.user_id == user.id) for e in current]
    return QueueLine(
        service_id=service.id,
        is_open=service.is_open,
        length=len(current),
        entries=spots,
        join_position=normal_position,
        join_wait=wait_time.estimate_wait(normal_position, service),
        priority_join_position=priority_position,
        priority_join_wait=wait_time.estimate_wait(priority_position, service),
    )


@router.post("/services/{service_id}/queue", status_code=201, response_model=QueueEntryPublic)
def join(
    service_id: str,
    body: QueueJoin | None = None,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    service = find_service(session, service_id)
    priority = body.priority if body is not None else "normal"  # no body means a normal join
    entry = queue_engine.join(session, user, service, priority)
    session.commit()
    return entry_out(session, entry)


@router.get("/me/queue-entry", response_model=QueueEntryPublic | None)
def my_entry(
    organization_id: str = Query(alias="organizationId"),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    check_organization(session, organization_id)
    entry = queue_engine.my_entry(session, user, organization_id)
    return None if entry is None else entry_out(session, entry)


@router.delete("/me/queue-entry", status_code=204)
def leave(
    organization_id: str = Query(alias="organizationId"),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> None:
    check_organization(session, organization_id)
    queue_engine.leave(session, user, organization_id)
    session.commit()


@router.delete("/me/queue-entry/served", status_code=204)
def dismiss_served(
    organization_id: str = Query(alias="organizationId"),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> None:
    check_organization(session, organization_id)
    queue_engine.dismiss_served(session, user, organization_id)
    session.commit()
