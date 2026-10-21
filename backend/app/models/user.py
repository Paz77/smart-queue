from uuid import uuid4

from pydantic import ConfigDict, EmailStr
from pydantic.alias_generators import to_camel
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: f"u-{uuid4().hex[:8]}", primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: str = "user"  # "user" or "admin"
    organization_id: str | None = Field(default=None, foreign_key="organization.id")  # admins only


class UserCreate(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, strict=True)

    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, strict=True)

    email: EmailStr
    password: str = Field(min_length=1)


class UserPublic(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    id: str
    name: str
    email: str
    role: str
    organization_id: str | None


class AuthResponse(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    user: UserPublic
    token: str
