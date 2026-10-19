from datetime import datetime

from sqlmodel import Session

from app.models import QueueEntry, Visit


def record_visit(session: Session, entry: QueueEntry, outcome: str, served_at: datetime | None = None) -> Visit | None:
    """Record a visit when someone is served, leaves or is removed."""
    return None  # Not implemented yet
