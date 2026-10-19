from sqlmodel import Session

from app.models import Service


def notify(session: Session, user_id: str, organization_id: str, type: str, title: str, message: str) -> None:
    """Create a notification for one user."""
    pass  # Not implemented yet


def announce_line_changes(session: Session, service: Service, before_positions: dict[str, int]) -> None:
    """Notify everyone in the line whose position changed since before_positions."""
    pass  # Not implemented yet
