from datetime import datetime

from sqlmodel import Session, col, select

from app.models import QueueEntry, Service, Visit

# How a time in line ended. "served" is the only one that sets served_at.
OUTCOMES = ("served", "left", "removed", "no_show")


def record_visit(session: Session, entry: QueueEntry, outcome: str, served_at: datetime | None = None) -> Visit | None:
    """Record a visit when someone is served, leaves or is removed.

    Copies the facts off the queue entry before the engine deletes it, so the
    visit survives the entry. Always returns the new Visit; the optional in the
    return type is kept from the day-1 contract.

    Does not commit. The route commits once, so one request is all-or-nothing.
    """
    if outcome not in OUTCOMES:
        # A caller bug rather than bad user input, so fail loudly instead of
        # quietly dropping the visit.
        raise ValueError(f"Unknown outcome {outcome!r}. Expected one of {', '.join(OUTCOMES)}.")

    visit = Visit(
        user_id=entry.user_id,
        service_id=entry.service_id,
        joined_at=entry.joined_at,
        served_at=served_at if outcome == "served" else None,
        outcome=outcome,
    )
    session.add(visit)
    return visit


def list_for_user(session: Session, user_id: str, organization_id: str) -> list[Visit]:
    """One person's past visits to an organization, newest first.

    Visits point at a service, and a service belongs to an organization, so the
    organization filter goes through Service.
    """
    statement = (
        select(Visit)
        .join(Service, col(Visit.service_id) == col(Service.id))
        .where(Visit.user_id == user_id, Service.organization_id == organization_id)
        .order_by(col(Visit.joined_at).desc())
    )
    return list(session.exec(statement).all())
