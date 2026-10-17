"""Shared test fixtures. Every test gets a fresh, seeded in-memory database.

    def test_something(user_client):
        response = user_client.get("/api/me/queue-entry")
        assert response.status_code == 200
"""

import secrets

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db import create_tables, get_session, make_engine
from app.main import app
from app.models import AuthToken
from app.seed import seed


@pytest.fixture
def session():
    """The test's database session. Use it to set up or check rows directly."""
    engine = make_engine("sqlite://")
    create_tables(engine)
    with Session(engine) as session:
        seed(session)
        yield session
    engine.dispose()


@pytest.fixture
def client(session):
    """A logged-out client. Its requests use this test's database."""
    app.dependency_overrides[get_session] = lambda: session
    # Not used as `with TestClient(app)`, so the app's startup seeding doesn't run.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def login_as(session, client):
    """login_as("a-2") returns a client logged in as that seeded user."""

    def _login_as(user_id: str) -> TestClient:
        token = secrets.token_urlsafe(32)
        session.add(AuthToken(token=token, user_id=user_id))
        session.commit()
        return TestClient(app, headers={"Authorization": f"Bearer {token}"})

    return _login_as


@pytest.fixture
def user_client(login_as):
    """Logged in as Jordan Lee (u-1), a visitor."""
    return login_as("u-1")


@pytest.fixture
def admin_client(login_as):
    """Logged in as Alex Rivera (a-1), admin of Northgate."""
    return login_as("a-1")
