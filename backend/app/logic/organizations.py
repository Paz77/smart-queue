from sqlmodel import Session, select

from app.models import Organization


def list_organizations(session: Session) -> list[Organization]:
    """Every organization, sorted by name."""
    return list(session.exec(select(Organization).order_by(Organization.name)).all())
