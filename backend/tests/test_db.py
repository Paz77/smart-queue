from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

import app.db
from app.db import create_tables, make_engine
from app.main import app as api
from app.models import AuthToken
from app.seed import seed


@pytest.fixture
def real_engine(monkeypatch):
    """A fresh database reached through the real get_session, not the test override."""
    engine = make_engine("sqlite://")
    create_tables(engine)
    with Session(engine) as session:
        seed(session)
        session.add(AuthToken(token="concurrent-token", user_id="u-1"))
        session.commit()
    monkeypatch.setattr(app.db, "engine", engine)
    api.dependency_overrides.clear()
    yield engine
    engine.dispose()


def test_requests_at_the_same_time(real_engine):
    def me(_):
        client = TestClient(api, headers={"Authorization": "Bearer concurrent-token"})
        return client.get("/api/auth/me").status_code

    with ThreadPoolExecutor(max_workers=10) as pool:
        statuses = list(pool.map(me, range(50)))

    assert statuses == [200] * 50
