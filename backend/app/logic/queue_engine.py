from sqlmodel import Session

from app.models import QueueEntry, Service, User


def join(session: Session, user: User, service: Service, priority: str = "normal") -> QueueEntry:
    """Add the user to the service's line and return their new entry."""
    raise NotImplementedError("Not implemented yet")


def leave(session: Session, user: User) -> None:
    """Take the user out of the line they're in."""
    raise NotImplementedError("Not implemented yet")


def serve_next(session: Session, service: Service) -> QueueEntry:
    """Serve the person at the front of the line and return their entry."""
    raise NotImplementedError("Not implemented yet")


def serve_entry(session: Session, entry: QueueEntry) -> QueueEntry:
    """Serve this specific entry and return it."""
    raise NotImplementedError("Not implemented yet")


def move(session: Session, entry: QueueEntry, position: int) -> None:
    """Move the entry to a new position in its line."""
    raise NotImplementedError("Not implemented yet")


def remove(session: Session, entry: QueueEntry) -> None:
    """Remove the entry from its line."""
    raise NotImplementedError("Not implemented yet")


def set_priority(session: Session, entry: QueueEntry, priority: str) -> None:
    """Change the entry's priority ("normal" or "priority") and reorder the line."""
    raise NotImplementedError("Not implemented yet")


def line(session: Session, service_id: str) -> list[QueueEntry]:
    """The service's waiting entries, front of the line first."""
    raise NotImplementedError("Not implemented yet")
