from datetime import datetime
from uuid import uuid4

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel
from sqlmodel import Field, SQLModel


class Visit(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"v-{uuid4().hex[:8]}", primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    service_id: str = Field(foreign_key="service.id", index=True)
    joined_at: datetime
    served_at: datetime | None = None  # None when the person left, was removed or didn't show
    outcome: str  # "served", "left", "removed" or "no_show"


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
