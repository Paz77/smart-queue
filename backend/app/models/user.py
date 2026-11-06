import re
from uuid import uuid4

from pydantic import ConfigDict, EmailStr, field_validator
from pydantic.alias_generators import to_camel
from sqlmodel import Field, Relationship, SQLModel

NAME_MAX_LENGTH = 100
PHONE_MAX_LENGTH = 20
PREFERENCES_MAX_LENGTH = 500

PHONE_PATTERN = re.compile(r"\+?[0-9 ().-]+")
PHONE_MIN_DIGITS = 7
PHONE_MAX_DIGITS = 15


class User(SQLModel, table=True):
    """Login credentials (the assignment's UserCredentials). Personal details live on UserProfile."""

    id: str = Field(default_factory=lambda: f"u-{uuid4().hex[:8]}", primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: str = "user"  # "user" or "admin"
    organization_id: str | None = Field(default=None, foreign_key="organization.id")  # admins only

    profile: "UserProfile" = Relationship(back_populates="user")


class UserProfile(SQLModel, table=True):
    """Personal details for one user. The email stays on User and is reached through user_id."""

    __tablename__ = "user_profile"

    user_id: str = Field(foreign_key="user.id", primary_key=True)
    full_name: str = Field(max_length=NAME_MAX_LENGTH)
    phone: str | None = Field(default=None, max_length=PHONE_MAX_LENGTH)
    preferences: str | None = Field(default=None, max_length=PREFERENCES_MAX_LENGTH)

    user: User = Relationship(back_populates="profile")


class UserCreate(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, strict=True)

    name: str = Field(min_length=1, max_length=NAME_MAX_LENGTH)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=PHONE_MAX_LENGTH)

    @field_validator("phone")
    @classmethod
    def phone_is_valid(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        digits = sum(character.isdigit() for character in value)
        if not PHONE_PATTERN.fullmatch(value) or not PHONE_MIN_DIGITS <= digits <= PHONE_MAX_DIGITS:
            raise ValueError("Enter a valid phone number.")
        return value


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
    phone: str | None

    @classmethod
    def from_user(cls, user: User) -> "UserPublic":
        """Combine a user's credentials and profile into the shape the API sends."""
        return cls(
            id=user.id,
            name=user.profile.full_name,
            email=user.email,
            role=user.role,
            organization_id=user.organization_id,
            phone=user.profile.phone,
        )


class AuthResponse(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    user: UserPublic
    token: str
