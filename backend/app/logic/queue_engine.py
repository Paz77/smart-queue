"""The queue engine: every change to a line goes through here

- Positions are stored and kept dense, 1..n, front of the line first
  Positions 1-2 are "almost_ready" and 3+ are "waiting"

- Serving keeps the row (status "served", position 0, served_at set) until the
  person dismisses it or joins again. 


_ordinal and the {id: position} snapshots are stand ins
for notifications.ordinal and notifications.snapshot_positions.
"""

from datetime import datetime, timezone

from sqlmodel import Session, col, select

from app.errors import ApiError
from app.logic import history, notifications, wait_time
from app.models import QueueEntry, Service, User

PRIORITIES = ("normal", "priority")
ALMOST_READY_WITHIN = 2  # the next two people to be called


def join(session: Session, user: User, service: Service, priority: str = "normal") -> QueueEntry:
    """Add the user to the service's line and return their new entry"""
    if user.role == "admin":
        raise ApiError(403, "forbidden", "Admins can't join a line.")
    _check_priority(priority)
    if not service.is_open:
        raise ApiError(409, "service_closed", f"{service.name} is closed right now.")
    if _active_entry(session, user.id, service.organization_id) is not None:
        raise ApiError(409, "already_in_line", "You're already in a line here. Leave it before joining another.")

    dismiss_served(session, user, service.organization_id)
    current = line(session, service.id)
    before = {e.id: e.position for e in current}
    entry = QueueEntry(
        service_id=service.id,
        user_id=user.id,
        priority=priority,
        position=join_position(current, priority),  # set before session.add: position can't be empty
    )
    session.add(entry)
    current.insert(entry.position - 1, entry)
    _renumber(current)

    notifications.announce_line_changes(session, service, before)
    wait = format_wait(wait_time.estimate_wait(entry.position, service))
    notifications.notify(
        session,
        user.id,
        service.organization_id,
        "queue_update",
        f"Joined {service.name}",
        f"You are {_ordinal(entry.position)} in line. Estimated wait is {wait}.",
    )
    return entry


def leave(session: Session, user: User, organization_id: str) -> None:
    """Take the user out of the line they're in at this organization. 404 if they aren't in one"""
    entry = _active_entry(session, user.id, organization_id)
    if entry is None:
        raise ApiError(404, "not_in_line", "You aren't in a line here.")
    service = session.get(Service, entry.service_id)
    _take_out(session, service, entry, "left", f"Left {service.name}", "You gave up your place in line.")


def serve_next(session: Session, service: Service) -> QueueEntry:
    """Serve the person at the front of the line and return their entry"""
    current = line(session, service.id)
    if not current:
        raise ApiError(409, "queue_empty", "Nobody is waiting in this line.")
    return serve_entry(session, current[0])


def serve_entry(session: Session, entry: QueueEntry) -> QueueEntry:
    """Serve this specific entry and return it."""
    _check_in_line(entry)
    service = session.get(Service, entry.service_id)
    current = line(session, service.id)
    before = {e.id: e.position for e in current}

    entry.status = "served"
    entry.position = 0
    entry.served_at = datetime.now(timezone.utc)
    visit = history.record_visit(session, entry, "served", entry.served_at)
    if visit is not None:
        service.last_called_visit_id = visit.id
    _renumber([e for e in current if e.id != entry.id])

    notifications.announce_line_changes(session, service, before)
    notifications.notify(
        session,
        entry.user_id,
        service.organization_id,
        "status_change",
        "It is your turn",
        f"{service.name} is ready for you. Please go to the service desk.",
    )
    return entry


def move(session: Session, entry: QueueEntry, position: int) -> None:
    """Move the entry to a new position in its line"""
    _check_in_line(entry)
    service = session.get(Service, entry.service_id)
    current = line(session, service.id)
    index = _index_of(current, entry)
    target = min(max(position, 1), len(current))
    if target == index + 1:
        return

    before = {e.id: e.position for e in current}
    others = current[:index] + current[index + 1 :]
    others.insert(target - 1, current[index])
    _renumber(others)
    notifications.announce_line_changes(session, service, before)


def remove(session: Session, entry: QueueEntry) -> None:
    """Remove the entry from its line"""
    _check_in_line(entry)
    service = session.get(Service, entry.service_id)
    _take_out(session, service, entry, "removed", f"Removed from {service.name}", "Staff took you out of the line.")


def set_priority(session: Session, entry: QueueEntry, priority: str) -> None:
    """Change the entry's priority ("normal" or "priority") and reorder the line"""
    _check_priority(priority)
    _check_in_line(entry)
    if priority == entry.priority:
        return

    service = session.get(Service, entry.service_id)
    current = line(session, service.id)
    before = {e.id: e.position for e in current}
    index = _index_of(current, entry)
    entry = current[index]
    others = current[:index] + current[index + 1 :]
    # Where the priority group ends. Promoted people move up to it but never back;
    # demoted people move back to it but never forward.
    boundary = join_position(others, "priority") - 1
    target = min(index, boundary) if priority == "priority" else max(index, boundary)
    others.insert(target, entry)
    entry.priority = priority
    _renumber(others)
    notifications.announce_line_changes(session, service, before)


def line(session: Session, service_id: str) -> list[QueueEntry]:
    """The service's waiting entries, front of the line first"""
    statement = (
        select(QueueEntry)
        .where(QueueEntry.service_id == service_id, QueueEntry.status != "served")
        .order_by(col(QueueEntry.position), col(QueueEntry.joined_at))
    )
    return list(session.exec(statement).all())


def join_position(entries: list[QueueEntry], priority: str) -> int:
    """Where someone joining now would go: right after the last priority person, or at the back"""
    if priority != "priority":
        return len(entries) + 1
    after = 0
    for index, entry in enumerate(entries, start=1):
        if entry.priority == "priority":
            after = index
    return after + 1


def my_entry(session: Session, user: User, organization_id: str) -> QueueEntry | None:
    """The user's entry here: the active one, else the newest served one, else None"""
    active = _active_entry(session, user.id, organization_id)
    if active is not None:
        return active
    statement = (
        _in_organization(user.id, organization_id)
        .where(QueueEntry.status == "served")
        .order_by(col(QueueEntry.served_at).desc())
    )
    return session.exec(statement).first()


def dismiss_served(session: Session, user: User, organization_id: str) -> None:
    """Delete the user's served entries at this organization. Safe to call when there are none"""
    statement = _in_organization(user.id, organization_id).where(QueueEntry.status == "served")
    for entry in session.exec(statement).all():
        session.delete(entry)


def format_wait(minutes: int) -> str:
    #45 -> "45 min", 60 -> "1 hr", 75 -> "1 hr 15 min", Same as formatWait in the frontend
    if minutes < 60:
        return f"{minutes} min"
    hours, rest = divmod(minutes, 60)
    if rest == 0:
        return f"{hours} hr"
    return f"{hours} hr {rest} min"


def _renumber(entries: list[QueueEntry]) -> None:
    """Number a line 1..n in its current order and set each status to match"""
    for position, entry in enumerate(entries, start=1):
        entry.position = position
        entry.status = "almost_ready" if position <= ALMOST_READY_WITHIN else "waiting"


def _check_priority(priority: str) -> None:
    if priority not in PRIORITIES:
        raise ApiError(422, "validation_error", "Some fields are invalid.", {"priority": "Choose normal or priority."})


def _check_in_line(entry: QueueEntry) -> None:
    if entry.status == "served":
        raise ApiError(409, "not_in_line", "This person has already been served.")


def _index_of(entries: list[QueueEntry], entry: QueueEntry) -> int:
    # Compare ids: == on model objects isn't reliable once the session has expired them.
    return next(index for index, e in enumerate(entries) if e.id == entry.id)


def _in_organization(user_id: str, organization_id: str):
    """A query for this user's entries in any of the organization's lines"""
    return (
        select(QueueEntry)
        .join(Service, col(QueueEntry.service_id) == col(Service.id))
        .where(QueueEntry.user_id == user_id, Service.organization_id == organization_id)
    )


def _active_entry(session: Session, user_id: str, organization_id: str) -> QueueEntry | None:
    # Oldest first, so the pick is stable for the few seed visitors who are in two lines at once
    statement = (
        _in_organization(user_id, organization_id)
        .where(QueueEntry.status != "served")
        .order_by(col(QueueEntry.joined_at))
    )
    return session.exec(statement).first()


def _take_out(session: Session, service: Service, entry: QueueEntry, outcome: str, title: str, message: str) -> None:
    """Record the visit, delete the entry and close the gap it leaves"""
    current = line(session, service.id)
    before = {e.id: e.position for e in current}
    history.record_visit(session, entry, outcome)  # while the row still exists
    session.delete(entry)
    _renumber([e for e in current if e.id != entry.id])

    notifications.announce_line_changes(session, service, before)
    notifications.notify(session, entry.user_id, service.organization_id, "status_change", title, message)


# Copy of notifications.ordinal from Tina's branch, switch to it once that merges
def _ordinal(n: int) -> str:
    """1 -> "1st", 2 -> "2nd", 11 -> "11th"."""
    if 10 <= n % 100 <= 20:
        return f"{n}th"
    return f"{n}" + {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
