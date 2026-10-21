from uuid import uuid4

from pydantic import BaseModel, ConfigDict
from sqlmodel import Field, SQLModel


class Organization(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"org-{uuid4().hex[:8]}", primary_key=True)
    name: str
    person_singular: str  # "Student", "Patient"
    person_plural: str
    backdrop_url: str | None = None


class OrganizationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    person_singular: str = Field(serialization_alias="personSingular")
    person_plural: str = Field(serialization_alias="personPlural")
    backdrop_url: str | None = Field(serialization_alias="backdropUrl")
