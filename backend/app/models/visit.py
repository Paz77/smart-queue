from datetime import datetime
from uuid import uuid4

from sqlmodel import Field, SQLModel


class Visit(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"v-{uuid4().hex[:8]}", primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    service_id: str = Field(foreign_key="service.id", index=True)
    joined_at: datetime
    served_at: datetime | None = None  # None when the person left, was removed or didn't show
    outcome: str  # "served", "left", "removed" or "no_show"
