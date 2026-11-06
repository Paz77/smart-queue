from datetime import datetime, timezone
from uuid import uuid4

from sqlmodel import Field, SQLModel


class Queue(SQLModel, table=True):
    """A service's line. Each service has exactly one; opening or closing the service flips its status.

    QueueEntry rows belong to a queue, and the queue belongs to a service.
    """

    id: str = Field(default_factory=lambda: f"queue-{uuid4().hex[:8]}", primary_key=True)
    service_id: str = Field(foreign_key="service.id", unique=True, index=True)  # unique: one queue per service
    status: str = "closed"  # "open" or "closed". New queues start closed, like new services.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
