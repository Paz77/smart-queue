"""Authentication contract checks and tests of existing permission helpers.

Add the admin endpoint matrix when those routes exist. Until then, exercise
require_admin directly without introducing fake application endpoints.
"""

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from app.deps import current_user, require_admin
from app.errors import ApiError
from app.models import AuthToken, User


def assert_unauthorized(response):
    assert response.status_code == 401, response.text
    error = response.json()["error"]
    assert error["code"] == "unauthorized"
    assert isinstance(error["message"], str) and error["message"].strip()
    assert isinstance(error["fields"], dict)


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Basic abc123"}, {"Authorization": "Bearer"}, {"Authorization": "Bearer unknown-token"}],
    ids=["missing-header", "wrong-scheme", "empty-bearer", "unknown-token"],
)
def test_me_requires_valid_authentication(client, headers):
    assert_unauthorized(client.get("/api/auth/me", headers=headers))


@pytest.mark.parametrize("method,path", [("GET", "/api/auth/me"), ("POST", "/api/auth/logout")])
def test_auth_endpoints_require_token(client, method, path):
    assert_unauthorized(client.request(method, path))


def test_token_with_missing_user_is_rejected(client, session):
    session.add(AuthToken(token="orphan-token", user_id="nonexistent-user"))
    session.commit()
    assert_unauthorized(client.get("/api/auth/me", headers={"Authorization": "Bearer orphan-token"}))


def test_valid_token_identifies_correct_user(user_client):
    response = user_client.get("/api/auth/me")
    assert response.status_code == 200, response.text
    assert response.json()["id"] == "u-1"


@pytest.mark.parametrize("token_state", ["missing", "unknown", "orphan"])
def test_current_user_rejects_invalid_credentials(session, token_state):
    credentials = None
    if token_state != "missing":
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="test-token")
    if token_state == "orphan":
        session.add(AuthToken(token="test-token", user_id="nonexistent-user"))
        session.commit()
    with pytest.raises(ApiError) as caught:
        current_user(credentials=credentials, session=session)
    assert caught.value.status == 401
    assert caught.value.code == "unauthorized"
    assert caught.value.message.strip()
    assert isinstance(caught.value.fields, dict)


def test_current_user_returns_token_owner(session):
    session.add(AuthToken(token="valid-token", user_id="u-1"))
    session.commit()
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
    assert current_user(credentials=credentials, session=session) is session.get(User, "u-1")


@pytest.mark.parametrize(
    "user_id,organization_id",
    [
        ("u-1", "org-northgate"),
        ("u-1", "org-riverside"),
        ("a-1", "org-riverside"),
        ("a-2", "org-northgate"),
    ],
    ids=["visitor-northgate", "visitor-riverside", "northgate-admin-other-org", "riverside-admin-other-org"],
)
def test_require_admin_rejects_unauthorized_user(session, user_id, organization_id):
    user = session.get(User, user_id)
    with pytest.raises(ApiError) as caught:
        require_admin(organization_id, user)
    assert caught.value.status == 403
    assert caught.value.code == "forbidden"
    assert caught.value.message.strip()
    assert isinstance(caught.value.fields, dict)


@pytest.mark.parametrize("user_id,organization_id", [("a-1", "org-northgate"), ("a-2", "org-riverside")])
def test_require_admin_allows_own_organization(session, user_id, organization_id):
    user = session.get(User, user_id)
    assert require_admin(organization_id, user) is user
