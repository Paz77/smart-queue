"""Service management and the admin's view of a line.

Changes to the line itself (serve, move, remove, priority) go through the queue
engine. This file looks things up, edits services and builds the responses.
"""

from sqlmodel import Session, col, select

from app.errors import ApiError
from app.logic import notifications, queue_engine, wait_time
from app.models import Organization, QueueEntry, Service, User, Visit
from app.models.service import (
    AdminQueue,
    AdminQueueEntry,
    LastCalled,
    ServiceCreate,
    ServicePublic,
    ServiceUpdate,
)


def get_organization(session: Session, organization_id: str) -> Organization:
    organization = session.get(Organization, organization_id)
    if organization is None:
        raise ApiError(404, "not_found", "Organization not found.")
    return organization


def get_service(session: Session, service_id: str) -> Service:
    service = session.get(Service, service_id)
    if service is None:
        raise ApiError(404, "not_found", "Service not found.")
    return service


def get_entry(session: Session, entry_id: str) -> QueueEntry:
    entry = session.get(QueueEntry, entry_id)
    if entry is None:
        raise ApiError(404, "not_found", "Queue entry not found.")
    return entry


def list_services(session: Session, organization_id: str) -> list[Service]:
    """The organization's services, sorted by name. 404 if the organization doesn't exist."""
    get_organization(session, organization_id)
    statement = select(Service).where(Service.organization_id == organization_id).order_by(col(Service.name))
    return list(session.exec(statement).all())


def create_service(session: Session, organization_id: str, data: ServiceCreate) -> Service:
    """Add a service. It starts closed; the admin opens it when ready."""
    get_organization(session, organization_id)
    service = Service(organization_id=organization_id, is_open=False, **data.model_dump())
    session.add(service)
    return service


def update_service(session: Session, service: Service, data: ServiceUpdate) -> Service:
    """Change the fields that were sent. Opening or closing tells everyone in the line."""
    changes = data.model_dump(exclude_none=True)
    is_open = changes.pop("is_open", None)
    for field, value in changes.items():
        setattr(service, field, value)
    if is_open is not None:
        set_open(session, service, is_open)
    session.add(service)
    return service


def set_open(session: Session, service: Service, is_open: bool) -> None:
    """Open or close the line. People already in it keep their place either way."""
    if service.is_open == is_open:
        return
    service.is_open = is_open

    organization = session.get(Organization, service.organization_id)
    waiting = queue_engine.line(session, service.id)
    if is_open:
        title = f"{service.name} is open"
        message = f"{organization.person_plural} can join the line now."
    else:
        title = f"{service.name} is closed"
        message = "You keep your place in line. No one new can join for now."
    for entry in waiting:
        notifications.notify(session, entry.user_id, service.organization_id, "queue_update", title, message)


def to_public(session: Session, service: Service) -> ServicePublic:
    """The service plus its line length and the wait for someone joining now."""
    current = queue_engine.line(session, service.id)
    wait = wait_time.estimate_wait(queue_engine.join_position(current, "normal"), service)
    return ServicePublic.model_validate(service, update={"queue_length": len(current), "estimated_wait": wait})


def admin_queue(session: Session, service: Service) -> AdminQueue:
    """The line as admins see it: names, priority and wait, plus who was called last."""
    entries = []
    for entry in queue_engine.line(session, service.id):
        user = session.get(User, entry.user_id)
        wait = wait_time.estimate_wait(entry.position, service)
        entries.append(AdminQueueEntry.model_validate(entry, update={"user_name": user.name, "estimated_wait": wait}))
    return AdminQueue(service=to_public(session, service), entries=entries, last_called=last_called(session, service))


def last_called(session: Session, service: Service) -> LastCalled | None:
    """The last person served at this service, or None if nobody has been yet."""
    if service.last_called_visit_id is None:
        return None
    visit = session.get(Visit, service.last_called_visit_id)
    if visit is None or visit.served_at is None:
        return None
    user = session.get(User, visit.user_id)
    return LastCalled(user_name=user.name, called_at=visit.served_at)
