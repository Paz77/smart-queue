from uuid import uuid4

from sqlmodel import Field, SQLModel


class Organization(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"org-{uuid4().hex[:8]}", primary_key=True)
    name: str
    person_singular: str  # "Student", "Patient"
    person_plural: str
    backdrop_url: str | None = None
