from uuid import uuid4

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
