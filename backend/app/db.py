"""The database connection.

Routes get a session with `session: Session = Depends(get_session)` and pass it
into logic functions. Tests swap get_session for their own (see tests/conftest.py).
"""

import threading
from collections.abc import Iterator

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.config import DATABASE_URL


def make_engine(url: str = DATABASE_URL):
    """Create an engine. Tests call this to get a fresh in-memory database."""
    if not url.startswith("sqlite"):
        return create_engine(url)

    # FastAPI runs routes on worker threads, and SQLite only lets the thread
    # that opened a connection use it unless this is turned off.
    options = {"connect_args": {"check_same_thread": False}}

    # Every new connection to "sqlite://" opens its own *empty* database.
    # StaticPool keeps one shared connection, so every request sees the same data.
    # Don't remove either setting.
    if url in ("sqlite://", "sqlite:///:memory:"):
        options["poolclass"] = StaticPool

    return create_engine(url, **options)


engine = make_engine()

# Requests run on several threads at once, and SQLite can't serve two threads on one
# connection. Every request takes this lock, so they use the database one at a time.
_lock = threading.Lock()


def create_tables(target_engine=engine) -> None:
    """Create a table for every model."""
    import app.models  # noqa: F401  Tables only get created for classes Python has imported.

    SQLModel.metadata.create_all(target_engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, closed when the request ends."""
    with _lock, Session(engine) as session:
        yield session
