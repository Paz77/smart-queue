from datetime import datetime, timezone
from uuid import uuid4

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel
from sqlmodel import Field, SQLModel

from app.models.checks import one_of

NOTIFICATION_TYPES = ("queue_update", "status_change")


class Notification(SQLModel, table=True):
    __table_args__ = (one_of("notification", "type", NOTIFICATION_TYPES),)

    id: str = Field(default_factory=lambda: f"n-{uuid4().hex[:8]}", primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    organization_id: str = Field(foreign_key="organization.id", index=True)
    type: str  # one of NOTIFICATION_TYPES
    title: str
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read: bool = False


class NotificationRead(SQLModel):
    """Body of PATCH /me/notifications/{id}."""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, strict=True)

    read: bool


class NotificationPublic(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    id: str
    type: str
    title: str
    message: str
    created_at: datetime
    read: bool
