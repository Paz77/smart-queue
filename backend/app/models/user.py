from uuid import uuid4

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"u-{uuid4().hex[:8]}", primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: str = "user"  # "user" or "admin"
    organization_id: str | None = Field(default=None, foreign_key="organization.id")  # admins only
