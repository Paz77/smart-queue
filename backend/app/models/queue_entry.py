from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel
from sqlmodel import Field, SQLModel


class QueueEntry(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"q-{uuid4().hex[:8]}", primary_key=True)
    service_id: str = Field(foreign_key="service.id", index=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    priority: str = "normal"  # "normal" or "priority"
    position: int  # 1 is the front of the line
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "waiting"  # "waiting", "almost_ready" or "served"
    served_at: datetime | None = None  # set when status becomes "served"


class QueueJoin(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, strict=True)

    priority: Literal["normal", "priority"] = "normal"


class QueueEntryPublic(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    id: str
    service_id: str
    priority: str
    position: int
    status: str
    joined_at: datetime
    served_at: datetime | None
    estimated_wait: int  # minutes


class QueueSpot(SQLModel):
    #One place in a line as visitors see it
    #No names or user ids

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    id: str
    position: int
    status: str
    is_me: bool


class QueueLine(SQLModel):
    """A service's line, plus where someone joining now would land and how long they'd wait"""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    service_id: str
    is_open: bool
    length: int
    entries: list[QueueSpot]
    join_position: int
    join_wait: int  # minutes
    priority_join_position: int
    priority_join_wait: int  # minutes
