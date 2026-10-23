"""The dev-only demo controls."""

from datetime import datetime, timezone

from sqlmodel import select

from app.models import Notification, QueueEntry, User, Visit


def test_reset_puts_the_sample_data_back(client, session):
    session.delete(session.exec(select(QueueEntry)).first())
    session.commit()
    fewer = len(session.exec(select(QueueEntry)).all())

    assert client.post("/api/dev/reset").status_code == 204
    assert len(session.exec(select(QueueEntry)).all()) > fewer


def test_reset_clears_rows_added_during_the_demo(client, session):
    session.add(
        Visit(
            user_id="u-1",
            service_id="svc-it",
            joined_at=datetime(2026, 10, 22, 10, 0, tzinfo=timezone.utc),
            outcome="left",
        )
    )
    session.commit()
    before = len(session.exec(select(Visit)).all())

    client.post("/api/dev/reset")

    assert len(session.exec(select(Visit)).all()) < before


def test_reset_restores_every_table(client, session):
    client.post("/api/dev/reset")

    for table in (User, QueueEntry, Visit, Notification):
        assert session.exec(select(table)).first() is not None, f"{table.__name__} came back empty"


def test_reset_signs_everyone_out(client, login_as):
    signed_in = login_as("u-1")
    assert signed_in.get("/api/auth/me").status_code == 200

    client.post("/api/dev/reset")

    assert signed_in.get("/api/auth/me").status_code == 401


def test_sign_in_as_returns_a_working_token(client):
    response = client.post("/api/dev/sign-in-as/a-1")

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["name"] == "Alex Rivera"
    assert body["user"]["role"] == "admin"

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.json()["id"] == "a-1"


def test_sign_in_as_needs_no_password(client):
    """That is the whole point, and the reason this router is dev only."""
    assert client.post("/api/dev/sign-in-as/u-1").status_code == 200


def test_sign_in_as_404s_for_an_unknown_account(client):
    response = client.post("/api/dev/sign-in-as/u-nope")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_switching_accounts_gives_separate_sessions(client):
    jordan = client.post("/api/dev/sign-in-as/u-1").json()["token"]
    alex = client.post("/api/dev/sign-in-as/a-1").json()["token"]

    assert jordan != alex
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {jordan}"}).json()["id"] == "u-1"
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {alex}"}).json()["id"] == "a-1"


def test_list_users_offers_every_account(client):
    users = client.get("/api/dev/users").json()

    assert len(users) == 11  # 9 visitors + 2 admins in the seed
    assert {u["role"] for u in users} == {"user", "admin"}


def test_list_users_never_includes_a_password(client):
    for user in client.get("/api/dev/users").json():
        assert "passwordHash" not in user
        assert "password" not in user


def test_dev_router_is_left_out_when_not_in_dev():
    """QUEUESMART_ENV=prod has to remove these endpoints, not just hide them."""
    import importlib

    from app import config, main

    original = config.IS_DEV
    try:
        config.IS_DEV = False
        reloaded = importlib.reload(main)
        paths = reloaded.app.openapi()["paths"]
        assert not any(path.startswith("/api/dev") for path in paths)
        # The rest of the API is still there.
        assert "/api/auth/login" in paths
    finally:
        config.IS_DEV = original
        importlib.reload(main)
