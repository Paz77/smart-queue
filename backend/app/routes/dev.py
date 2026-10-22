"""Demo controls for the Dev Tools panel in the frontend.

Only mounted when QUEUESMART_ENV is "dev" (see config.py and main.py), so these
never exist in a production build. They let a demo be reset and let someone
switch accounts without typing a password.
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session, delete, select

from app.db import get_session
from app.errors import ApiError
from app.logic.auth import issue_token
from app.models import AuthToken, Notification, Organization, QueueEntry, Service, User, Visit
from app.models.user import AuthResponse, UserPublic
from app.seed import seed

router = APIRouter(prefix="/dev", tags=["dev"])

# Cleared in this order so a row never outlives something it points at.
TABLES = (AuthToken, Notification, Visit, QueueEntry, Service, User, Organization)


@router.post("/reset", status_code=204)
def reset(session: Session = Depends(get_session)) -> None:
    """Throw away everything and load the sample data again.

    Signs everyone out as a side effect, since the tokens go with the rest.
    """
    for table in TABLES:
        session.exec(delete(table))
    session.commit()

    seed(session)


@router.post("/sign-in-as/{user_id}", response_model=AuthResponse)
def sign_in_as(user_id: str, session: Session = Depends(get_session)):
    """Sign in as any seeded account, no password. Dev only, obviously."""
    user = session.get(User, user_id)
    if user is None:
        raise ApiError(404, "not_found", "No account with that id.")

    auth_token = issue_token(session, user)
    session.commit()
    return AuthResponse(user=UserPublic.model_validate(user), token=auth_token.token)


@router.get("/users", response_model=list[UserPublic])
def list_users(session: Session = Depends(get_session)):
    """Every account, so the Dev Tools panel can offer them to switch between."""
    users = session.exec(select(User).order_by(User.name)).all()
    return [UserPublic.model_validate(user) for user in users]
