from datetime import datetime
from uuid import uuid4

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel
from sqlmodel import Field, SQLModel

from app.models.checks import one_of

# How a time in line ended. "served" is the only one that sets served_at.
OUTCOMES = ("served", "left", "removed", "no_show")


class Visit(SQLModel, table=True):
    __table_args__ = (one_of("visit", "outcome", OUTCOMES),)

    id: str = Field(default_factory=lambda: f"v-{uuid4().hex[:8]}", primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    service_id: str = Field(foreign_key="service.id", index=True)
    joined_at: datetime
    served_at: datetime | None = None  # None when the person left, was removed or didn't show
    outcome: str  # one of OUTCOMES


class VisitPublic(SQLModel):
    """A past visit. Carries serviceName so the history screen does not have to
    look up each service separately."""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    id: str
    service_id: str
    service_name: str
    joined_at: datetime
    served_at: datetime | None
    outcome: str
