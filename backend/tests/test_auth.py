"""Contract tests for the real auth API, expected to fail until it is implemented."""

import hashlib
import hmac

import pytest
from sqlmodel import select

from app.models import AuthToken, User


@pytest.fixture
def registration():
    return {"name": "Test Visitor", "email": "visitor@example.com", "password": "password123"}


@pytest.fixture
def credentials():
    return {"email": "jordan@queuesmart.dev", "password": "password123"}


def auth_state(session):
    """Snapshot values rather than mutable ORM instances."""
    users = session.exec(select(User).order_by(User.id)).all()
    tokens = session.exec(select(AuthToken).order_by(AuthToken.token)).all()
    return ([user.model_dump() for user in users], [token.model_dump() for token in tokens])


def assert_error(response, status, field=None):
    assert response.status_code == status, response.text
    error = response.json()["error"]
    assert isinstance(error["code"], str) and error["code"]
    assert isinstance(error["message"], str) and error["message"].strip()
    assert isinstance(error["fields"], dict)
    if status == 422:
        assert error["code"] == "validation_error"
    if status == 401:
        assert error["code"] == "unauthorized"
    if field is not None:
        assert isinstance(error["fields"][field], str) and error["fields"][field].strip()


def assert_public_user(user):
    assert "password" not in user
    assert "password_hash" not in user
    assert "passwordHash" not in user


def assert_auth_response(response, session, status):
    assert response.status_code == status, response.text
    body = response.json()
    user = body["user"]
    assert_public_user(user)
    assert_public_user(body)
    token = body["token"]
    assert isinstance(token, str) and token
    stored_token = session.get(AuthToken, token)
    assert stored_token is not None
    assert stored_token.user_id == user["id"]
    stored_user = session.get(User, user["id"])
    assert stored_user is not None
    assert user["name"] == stored_user.name
    assert user["email"] == stored_user.email
    assert user["role"] == stored_user.role
    assert user["organizationId"] == stored_user.organization_id
    return body


def assert_rejected(client, session, path, payload, status, field=None):
    before = auth_state(session)
    response = client.post(path, json=payload)
    assert_error(response, status, field)
    assert auth_state(session) == before


def assert_me(client, token, expected_user):
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    assert response.json() == expected_user
    assert_public_user(response.json())


def test_valid_registration(client, session, registration):
    before_users, before_tokens = auth_state(session)
    body = assert_auth_response(client.post("/api/auth/register", json=registration), session, 201)
    assert body["user"]["name"] == registration["name"]
    assert body["user"]["email"] == registration["email"]
    assert body["user"]["role"] == "user"
    assert body["user"]["organizationId"] is None
    users, tokens = auth_state(session)
    assert len(users) == len(before_users) + 1
    assert len(tokens) == len(before_tokens) + 1


@pytest.mark.parametrize("field", ["name", "email", "password"])
def test_registration_missing_required_field(client, session, registration, field):
    registration.pop(field)
    assert_rejected(client, session, "/api/auth/register", registration, 422, field)


@pytest.mark.parametrize("field", ["name", "email", "password"])
def test_registration_empty_required_field(client, session, registration, field):
    registration[field] = ""
    assert_rejected(client, session, "/api/auth/register", registration, 422, field)


def test_name_at_length_limit(client, session, registration):
    registration["name"] = "a" * 100
    body = assert_auth_response(client.post("/api/auth/register", json=registration), session, 201)
    assert body["user"]["name"] == registration["name"]


def test_name_too_long(client, session, registration):
    registration["name"] = "a" * 101
    assert_rejected(client, session, "/api/auth/register", registration, 422, "name")


@pytest.mark.parametrize("email", ["not-an-email", "visitor@", "@example.com"])
def test_registration_invalid_email(client, session, registration, email):
    registration["email"] = email
    assert_rejected(client, session, "/api/auth/register", registration, 422, "email")


@pytest.mark.parametrize("length", [7, 129])
def test_invalid_password_length(client, session, registration, length):
    registration["password"] = "p" * length
    assert_rejected(client, session, "/api/auth/register", registration, 422, "password")


@pytest.mark.parametrize("length", [8, 128])
def test_valid_password_length(client, session, registration, length):
    registration["password"] = "p" * length
    assert_auth_response(client.post("/api/auth/register", json=registration), session, 201)


@pytest.mark.parametrize("field", ["name", "email", "password"])
@pytest.mark.parametrize("value", [123, True, [], {}, None], ids=["number", "boolean", "list", "object", "null"])
def test_registration_invalid_field_type(client, session, registration, field, value):
    registration[field] = value
    assert_rejected(client, session, "/api/auth/register", registration, 422, field)


@pytest.mark.parametrize("email", ["jordan@queuesmart.dev", "JoRdAn@QueueSmart.Dev"])
def test_email_already_registered(client, session, registration, email):
    registration["email"] = email
    assert_rejected(client, session, "/api/auth/register", registration, 409, "email")


def test_email_is_lowercased(client, session, registration):
    registration["email"] = "ViSiToR@Example.COM"
    body = assert_auth_response(client.post("/api/auth/register", json=registration), session, 201)
    assert body["user"]["email"] == "visitor@example.com"
    assert session.get(User, body["user"]["id"]).email == "visitor@example.com"


def test_is_password_hashed(client, session, registration):
    body = assert_auth_response(client.post("/api/auth/register", json=registration), session, 201)
    stored = session.get(User, body["user"]["id"]).password_hash
    assert stored != registration["password"]
    algorithm, salt_hex, digest_hex = stored.split("$")
    assert algorithm == "scrypt"
    salt = bytes.fromhex(salt_hex)
    digest = bytes.fromhex(digest_hex)
    assert len(salt) == 16
    assert len(digest) == 32
    expected = hashlib.scrypt(registration["password"].encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    assert hmac.compare_digest(digest, expected)


def test_cant_promote_themselves_to_admin(client, session, registration):
    registration.update(role="admin", organizationId="org-northgate")
    body = assert_auth_response(client.post("/api/auth/register", json=registration), session, 201)
    assert body["user"]["role"] == "user"
    assert body["user"]["organizationId"] is None
    stored_user = session.get(User, body["user"]["id"])
    assert stored_user.role == "user"
    assert stored_user.organization_id is None


def test_registration_token_works(client, session, registration):
    body = assert_auth_response(client.post("/api/auth/register", json=registration), session, 201)
    assert_me(client, body["token"], body["user"])


@pytest.mark.parametrize(
    "email,password,user_id,role,organization_id",
    [
        ("jordan@queuesmart.dev", "password123", "u-1", "user", None),
        ("alex.rivera@queuesmart.dev", "admin123", "a-1", "admin", "org-northgate"),
    ],
    ids=["visitor", "admin"],
)
def test_log_in_response(client, session, email, password, user_id, role, organization_id):
    before_users, before_tokens = auth_state(session)
    body = assert_auth_response(
        client.post("/api/auth/login", json={"email": email, "password": password}), session, 200
    )
    assert body["user"]["id"] == user_id
    assert body["user"]["role"] == role
    assert body["user"]["organizationId"] == organization_id
    users, tokens = auth_state(session)
    assert users == before_users
    assert len(tokens) == len(before_tokens) + 1


def test_newly_registered_user_can_log_in(client, session, registration):
    registered = assert_auth_response(client.post("/api/auth/register", json=registration), session, 201)
    logged_in = assert_auth_response(
        client.post("/api/auth/login", json={key: registration[key] for key in ("email", "password")}),
        session,
        200,
    )
    assert logged_in["user"] == registered["user"]


@pytest.mark.parametrize(
    "email,password",
    [("jordan@queuesmart.dev", "wrong-password"), ("unknown@example.com", "password123")],
    ids=["wrong-password", "unknown-email"],
)
def test_bad_credentials(client, session, email, password):
    assert_rejected(client, session, "/api/auth/login", {"email": email, "password": password}, 401)


@pytest.mark.parametrize("field", ["email", "password"])
@pytest.mark.parametrize("missing", [True, False], ids=["missing", "empty"])
def test_login_required_credentials(client, session, credentials, field, missing):
    if missing:
        credentials.pop(field)
    else:
        credentials[field] = ""
    assert_rejected(client, session, "/api/auth/login", credentials, 422, field)


def test_login_invalid_email(client, session, credentials):
    credentials["email"] = "not-an-email"
    assert_rejected(client, session, "/api/auth/login", credentials, 422, "email")


@pytest.mark.parametrize("field", ["email", "password"])
@pytest.mark.parametrize("value", [123, True, [], {}, None], ids=["number", "boolean", "list", "object", "null"])
def test_login_invalid_credential_type(client, session, credentials, field, value):
    credentials[field] = value
    assert_rejected(client, session, "/api/auth/login", credentials, 422, field)


def test_login_token_works(client, session, credentials):
    body = assert_auth_response(client.post("/api/auth/login", json=credentials), session, 200)
    assert_me(client, body["token"], body["user"])


@pytest.mark.parametrize("user_id", ["u-1", "a-1"], ids=["visitor", "admin"])
def test_current_user(login_as, session, user_id):
    response = login_as(user_id).get("/api/auth/me")
    assert response.status_code == 200, response.text
    user = response.json()
    stored = session.get(User, user_id)
    assert user["id"] == stored.id
    assert user["name"] == stored.name
    assert user["email"] == stored.email
    assert user["role"] == stored.role
    assert user["organizationId"] == stored.organization_id
    assert_public_user(user)


def test_logout_removes_token(client, session, credentials):
    body = assert_auth_response(client.post("/api/auth/login", json=credentials), session, 200)
    response = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {body['token']}"})
    assert 200 <= response.status_code < 300, response.text
    session.expire_all()
    assert session.get(AuthToken, body["token"]) is None


def test_logged_out_token_is_rejected(client, session, credentials):
    body = assert_auth_response(client.post("/api/auth/login", json=credentials), session, 200)
    headers = {"Authorization": f"Bearer {body['token']}"}
    response = client.post("/api/auth/logout", headers=headers)
    assert 200 <= response.status_code < 300, response.text
    assert_error(client.get("/api/auth/me", headers=headers), 401)


def test_logout_preserves_account_and_allows_login(client, session, credentials):
    body = assert_auth_response(client.post("/api/auth/login", json=credentials), session, 200)
    before = session.get(User, body["user"]["id"]).model_dump()
    response = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {body['token']}"})
    assert 200 <= response.status_code < 300, response.text
    session.expire_all()
    assert session.get(User, body["user"]["id"]).model_dump() == before
    logged_in = assert_auth_response(client.post("/api/auth/login", json=credentials), session, 200)
    assert logged_in["user"] == body["user"]
    assert_me(client, logged_in["token"], logged_in["user"])
