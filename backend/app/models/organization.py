from uuid import uuid4

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel
from sqlmodel import Field, SQLModel


class Organization(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"org-{uuid4().hex[:8]}", primary_key=True)
    name: str
    person_singular: str  # "Student", "Patient"
    person_plural: str
    backdrop_url: str | None = None


class OrganizationPublic(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    id: str
    name: str
    person_singular: str
    person_plural: str
    backdrop_url: str | None
