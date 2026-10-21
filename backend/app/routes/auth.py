from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials
from sqlmodel import Session

from app.db import get_session
from app.deps import bearer, current_user
from app.logic import auth
from app.models import User
from app.models.user import AuthResponse, UserCreate, UserLogin, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


def auth_out(user: User, token: str) -> AuthResponse:
    return AuthResponse(user=UserPublic.model_validate(user), token=token)


@router.post("/register", status_code=201, response_model=AuthResponse)
def register(body: UserCreate, session: Session = Depends(get_session)):
    user, auth_token = auth.register(session, body.name, body.email, body.password)
    session.commit()
    return auth_out(user, auth_token.token)


@router.post("/login", response_model=AuthResponse)
def login(body: UserLogin, session: Session = Depends(get_session)):
    user, auth_token = auth.log_in(session, body.email, body.password)
    session.commit()
    return auth_out(user, auth_token.token)


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(current_user)):
    return UserPublic.model_validate(user)


@router.post("/logout", status_code=204)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> None:
    auth.log_out(session, credentials.credentials)
    session.commit()
