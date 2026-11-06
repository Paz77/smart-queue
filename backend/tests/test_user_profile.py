"""The credentials / profile split: what goes where, and the keys that join them."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, select

from app.db import create_tables, make_engine
from app.logic import auth
from app.models import User, UserProfile
from app.seed import USERS


@pytest.fixture
def registration():
    return {"name": "Test Visitor", "email": "visitor@example.com", "password": "password123", "phone": "(555) 010-0999"}


def profile_count(session):
    return len(session.exec(select(UserProfile)).all())


def test_tables_hold_the_right_columns():
    tables = SQLModel.metadata.tables
    assert set(tables["user"].columns.keys()) == {"id", "email", "password_hash", "role", "organization_id"}
    assert set(tables["user_profile"].columns.keys()) == {"user_id", "full_name", "phone", "preferences"}


def test_profile_primary_key_is_a_foreign_key_to_user():
    user_id = SQLModel.metadata.tables["user_profile"].columns["user_id"]
    assert user_id.primary_key
    assert [key.target_fullname for key in user_id.foreign_keys] == ["user.id"]


def test_profile_column_limits():
    columns = SQLModel.metadata.tables["user_profile"].columns
    assert not columns["full_name"].nullable
    assert columns["phone"].nullable
    assert columns["preferences"].nullable
    assert columns["full_name"].type.length == 100
    assert columns["phone"].type.length == 20
    assert columns["preferences"].type.length == 500


def test_register_stores_a_profile(client, session, registration):
    response = client.post("/api/auth/register", json=registration)
    assert response.status_code == 201, response.text
    user = response.json()["user"]
    assert user["name"] == "Test Visitor"
    assert user["phone"] == "(555) 010-0999"

    session.rollback()  # the profile must have been committed, not just added
    profile = session.get(UserProfile, user["id"])
    assert profile.full_name == "Test Visitor"
    assert profile.phone == "(555) 010-0999"
    assert profile.preferences is None
    assert profile.user.email == "visitor@example.com"


@pytest.mark.parametrize("body_change", [{"phone": None}, {}], ids=["null", "left-out"])
def test_phone_is_optional(client, session, registration, body_change):
    del registration["phone"]
    response = client.post("/api/auth/register", json={**registration, **body_change})
    assert response.status_code == 201, response.text
    user = response.json()["user"]
    assert user["phone"] is None
    assert session.get(UserProfile, user["id"]).phone is None


def test_phone_is_trimmed(client, registration):
    registration["phone"] = "  555-010-0999  "
    assert client.post("/api/auth/register", json=registration).json()["user"]["phone"] == "555-010-0999"


@pytest.mark.parametrize("phone", ["5550100", "+1 (555) 010-0999", "555.010.0999", "123456789012345"])
def test_valid_phone_formats(client, registration, phone):
    registration["phone"] = phone
    assert client.post("/api/auth/register", json=registration).status_code == 201


@pytest.mark.parametrize(
    "phone",
    ["", "   ", "555010", "1234567890123456", "call me", "555-CALL-NOW", "((((((((", "5+55-010-0999", "1" * 21, 5550100999, True, [], {}],
    ids=["empty", "blank", "too-few-digits", "too-many-digits", "words", "letters", "no-digits", "plus-inside", "too-long", "number", "boolean", "list", "object"],
)
def test_invalid_phone_rejected(client, session, registration, phone):
    registration["phone"] = phone
    users_before, profiles_before = len(session.exec(select(User)).all()), profile_count(session)

    response = client.post("/api/auth/register", json=registration)

    assert response.status_code == 422, response.text
    assert response.json()["error"]["fields"]["phone"].strip()
    assert len(session.exec(select(User)).all()) == users_before
    assert profile_count(session) == profiles_before


def test_taken_email_leaves_no_profile(client, session, registration):
    registration["email"] = "jordan@queuesmart.dev"
    before = profile_count(session)
    assert client.post("/api/auth/register", json=registration).status_code == 409
    assert profile_count(session) == before


def test_login_and_me_return_profile_fields(client, registration):
    client.post("/api/auth/register", json=registration)
    login = client.post("/api/auth/login", json={"email": registration["email"], "password": registration["password"]})
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["user"]["name"] == "Test Visitor"
    assert body["user"]["phone"] == "(555) 010-0999"

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.json() == body["user"]


def test_seed_gives_every_user_one_profile(session):
    profiles = session.exec(select(UserProfile)).all()
    assert len(profiles) == len(USERS)
    assert {profile.user_id for profile in profiles} == {user.id for user in session.exec(select(User)).all()}
    assert session.get(UserProfile, "u-1").full_name == "Jordan Lee"
    assert session.get(UserProfile, "u-1").phone == "(555) 010-0101"
    assert session.get(UserProfile, "u-3").phone is None


def test_admin_queue_names_come_from_profiles(admin_client, session):
    session.get(UserProfile, "u-2").full_name = "Renamed Visitor"
    session.commit()

    queue = admin_client.get("/api/admin/services/svc-advising/queue").json()

    names = {entry["userId"]: entry["userName"] for entry in queue["entries"]}
    assert names["u-2"] == "Renamed Visitor"
    assert names["u-1"] == "Jordan Lee"


def test_dev_users_sorted_by_profile_name(client):
    users = client.get("/api/dev/users").json()
    names = [user["name"] for user in users]
    assert names == sorted(names)


def test_dev_reset_restores_profiles(client, session):
    client.post("/api/auth/register", json={"name": "Extra", "email": "extra@example.com", "password": "password123"})
    assert profile_count(session) == len(USERS) + 1

    assert client.post("/api/dev/reset").status_code == 204

    assert profile_count(session) == len(USERS)


@pytest.fixture
def enforced_session():
    """An empty database with foreign keys switched on, which SQLite leaves off by default."""
    engine = make_engine("sqlite://")
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
    create_tables(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def test_database_rejects_a_profile_without_a_user(enforced_session):
    enforced_session.add(UserProfile(user_id="u-nope", full_name="Nobody"))
    with pytest.raises(IntegrityError):
        enforced_session.commit()


def test_user_and_profile_save_together_with_foreign_keys_on(enforced_session):
    enforced_session.add(User(id="u-new", email="new@example.com", password_hash="unused", profile=UserProfile(full_name="New")))
    enforced_session.commit()
    assert enforced_session.get(UserProfile, "u-new").user.email == "new@example.com"


def test_register_works_with_foreign_keys_on(enforced_session):
    user, auth_token = auth.register(enforced_session, "New", "new@example.com", "password123", "555-010-0999")
    enforced_session.commit()
    assert enforced_session.get(UserProfile, user.id).phone == "555-010-0999"
    assert auth_token.user_id == user.id


def test_database_rejects_a_second_profile_for_a_user(session):
    with pytest.raises(IntegrityError):
        session.connection().exec_driver_sql("INSERT INTO user_profile (user_id, full_name) VALUES ('u-1', 'Second')")


def test_database_requires_a_full_name(session):
    session.add(User(id="u-new", email="new@example.com", password_hash="unused"))
    session.flush()
    session.add(UserProfile(user_id="u-new", full_name=None))
    with pytest.raises(IntegrityError):
        session.commit()


def test_database_rejects_a_duplicate_email(session):
    session.add(User(email="jordan@queuesmart.dev", password_hash="unused"))
    with pytest.raises(IntegrityError):
        session.commit()
