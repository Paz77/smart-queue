"""Who is making the request. Use these in route signatures:

    @router.get("/me/queue-entry")
    def my_entry(user: User = Depends(current_user), session: Session = Depends(get_session)):
        ...
"""

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.db import get_session
from app.errors import ApiError
from app.models import AuthToken, User

# Reads "Authorization: Bearer <token>". Also adds the Authorize button to /docs.
bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: Session = Depends(get_session),
) -> User:
    """The logged-in user, or 401."""
    if credentials is None:
        raise ApiError(401, "unauthorized", "Please log in.")

    auth_token = session.get(AuthToken, credentials.credentials)
    user = session.get(User, auth_token.user_id) if auth_token else None
    if user is None:
        raise ApiError(401, "unauthorized", "Your session has ended. Please log in again.")
    return user


def require_admin(organization_id: str, user: User = Depends(current_user)) -> User:
    """The logged-in admin of organization_id, or 403 (401 if not logged in).

    Two ways to use it:

    1. As a dependency, when the path has {organization_id}. FastAPI fills it in from the URL:
           @router.post("/organizations/{organization_id}/services")
           def create(organization_id: str, admin: User = Depends(require_admin)): ...

    2. Called directly, when the organization comes from a row you looked up:
           def serve_next(service_id: str, user: User = Depends(current_user), ...):
               service = ...
               require_admin(service.organization_id, user)
    """
    if user.role != "admin":
        raise ApiError(403, "forbidden", "Only admins can do this.")
    if user.organization_id != organization_id:
        raise ApiError(403, "forbidden", "You can only manage your own organization.")
    return user
