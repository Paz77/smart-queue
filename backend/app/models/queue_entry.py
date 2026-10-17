from datetime import datetime, timezone
from uuid import uuid4

from sqlmodel import Field, SQLModel


class QueueEntry(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"q-{uuid4().hex[:8]}", primary_key=True)
    service_id: str = Field(foreign_key="service.id", index=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    priority: str = "normal"  # "normal" or "priority"
    position: int  # 1 is the front of the line
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "waiting"  # "waiting", "almost_ready" or "served"
