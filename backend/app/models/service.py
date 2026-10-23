from datetime import datetime
from typing import Literal
from uuid import uuid4

from pydantic import ConfigDict, model_validator
from pydantic.alias_generators import to_camel
from sqlmodel import Field, SQLModel


class Service(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"svc-{uuid4().hex[:8]}", primary_key=True)
    organization_id: str = Field(foreign_key="organization.id", index=True)
    name: str
    description: str
    expected_duration: int  # minutes per person
    priority: str = "medium"  # "low", "medium" or "high"
    is_open: bool = False  # new services start closed

    # The Visit of the last person called. A plain column, not a foreign key:
    # Visit already points at Service, and keys in both directions make table creation circular.
    last_called_visit_id: str | None = None


class ServiceCreate(SQLModel):
    # strict: expectedDuration "15" (text) is rejected, not turned into 15.
    # str_strip_whitespace: a name of only spaces counts as empty.
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, strict=True, str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=500)
    expected_duration: int = Field(ge=1, le=480)  # minutes per person
    priority: Literal["low", "medium", "high"] = "medium"


class ServiceUpdate(SQLModel):
    """Every field is optional. Only the ones sent are changed; null counts as not sent."""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, strict=True, str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, min_length=1, max_length=500)
    expected_duration: int | None = Field(default=None, ge=1, le=480)
    priority: Literal["low", "medium", "high"] | None = None
    is_open: bool | None = None


class ServicePublic(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    id: str
    organization_id: str
    name: str
    description: str
    expected_duration: int
    priority: str
    is_open: bool
    queue_length: int  # people waiting now
    estimated_wait: int  # minutes, for someone joining now


# --- The admin's view of a line (Queue Management screen)


class QueueEntryUpdate(SQLModel):
    """PATCH /admin/queue-entries/{id}. Send position, priority or both."""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, strict=True)

    position: int | None = Field(default=None, ge=1)
    priority: Literal["normal", "priority"] | None = None

    @model_validator(mode="after")
    def needs_a_change(self):
        if self.position is None and self.priority is None:
            raise ValueError("Send a position or a priority.")
        return self


class AdminQueueEntry(SQLModel):
    """One person in line, with their name. Only admins see this."""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    id: str
    user_id: str
    user_name: str
    priority: str
    position: int
    status: str
    joined_at: datetime
    estimated_wait: int  # minutes


class LastCalled(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    user_name: str
    called_at: datetime


class AdminQueue(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    service: ServicePublic
    entries: list[AdminQueueEntry]
    last_called: LastCalled | None
