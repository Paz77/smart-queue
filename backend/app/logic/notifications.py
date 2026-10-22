from sqlmodel import Session, col, select

from app.errors import ApiError
from app.models import Notification, QueueEntry, Service

# Someone is "almost ready" once they are one of the next two to be called.
# Mirrors the rule the queue engine uses when it sets QueueEntry.status.
ALMOST_READY_WITHIN = 2


def ordinal(n: int) -> str:
    """1 -> "1st", 2 -> "2nd", 11 -> "11th"."""
    if 10 <= n % 100 <= 20:
        return f"{n}th"
    return f"{n}" + {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")


def notify(session: Session, user_id: str, organization_id: str, type: str, title: str, message: str) -> None:
    """Create a notification for one user.

    Does not commit; the route commits once at the end of the request.
    """
    session.add(
        Notification(
            user_id=user_id,
            organization_id=organization_id,
            type=type,
            title=title,
            message=message,
        )
    )


def announce_line_changes(session: Session, service: Service, before_positions: dict[str, int]) -> None:
    """Notify everyone in the line whose position changed since before_positions.

    before_positions maps queue entry id -> position, snapshotted by the engine
    before it changed anything. Entries missing from it are new arrivals, whose
    "joined" notification the engine sends itself, so they are skipped here.

    Reads the line directly rather than through queue_engine.line() so this works
    before that function exists. Both order by position, so the result is the same.
    """
    statement = (
        select(QueueEntry)
        .where(QueueEntry.service_id == service.id, QueueEntry.status != "served")
        .order_by(col(QueueEntry.position))
    )

    for entry in session.exec(statement).all():
        before = before_positions.get(entry.id)
        if before is None or before == entry.position:
            continue

        place = f"{service.name}: you are now {ordinal(entry.position)} in line."
        moved_up = entry.position < before
        became_almost_ready = entry.position <= ALMOST_READY_WITHIN < before

        if became_almost_ready:
            notify(
                session,
                entry.user_id,
                service.organization_id,
                "status_change",
                "Almost your turn",
                f"{place} Start heading to the desk.",
            )
        elif moved_up:
            notify(session, entry.user_id, service.organization_id, "queue_update", "You moved up in line", place)
        else:
            notify(
                session, entry.user_id, service.organization_id, "queue_update", "Your place in line changed", place
            )


def snapshot_positions(session: Session, service_id: str) -> dict[str, int]:
    """Current positions, for the engine to pass back into announce_line_changes."""
    statement = select(QueueEntry).where(QueueEntry.service_id == service_id, QueueEntry.status != "served")
    return {entry.id: entry.position for entry in session.exec(statement).all()}


def list_for_user(session: Session, user_id: str, organization_id: str) -> list[Notification]:
    """One person's notifications for an organization, newest first."""
    statement = (
        select(Notification)
        .where(Notification.user_id == user_id, Notification.organization_id == organization_id)
        .order_by(col(Notification.created_at).desc())
    )
    return list(session.exec(statement).all())


def set_read(session: Session, user_id: str, notification_id: str, read: bool) -> Notification:
    """Mark one notification read or unread. 404 if it isn't this person's."""
    notification = session.get(Notification, notification_id)
    if notification is None or notification.user_id != user_id:
        raise ApiError(404, "not_found", "Notification not found.")

    notification.read = read
    session.add(notification)
    return notification


def mark_all_read(session: Session, user_id: str, organization_id: str) -> int:
    """Mark every unread notification for this organization read. Returns how many."""
    statement = select(Notification).where(
        Notification.user_id == user_id,
        Notification.organization_id == organization_id,
        col(Notification.read).is_(False),
    )
    unread = list(session.exec(statement).all())
    for notification in unread:
        notification.read = True
        session.add(notification)
    return len(unread)
