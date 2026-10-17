from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


# Named AuthToken, not Session: sqlmodel's Session is the database session every route uses.
class AuthToken(SQLModel, table=True):
    token: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
