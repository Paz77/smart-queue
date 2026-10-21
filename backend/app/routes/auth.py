from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlmodel import Session

from app.db import get_session
from app.deps import bearer, current_user
from app.logic import auth
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100, strict=True)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128, strict=True)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, strict=True)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    role: str
    organization_id: str | None = Field(serialization_alias="organizationId")


class AuthOut(BaseModel):
    user: UserOut
    token: str


def auth_out(user: User, token: str) -> AuthOut:
    return AuthOut(user=UserOut.model_validate(user), token=token)


@router.post("/register", status_code=201, response_model=AuthOut)
def register(body: RegisterIn, session: Session = Depends(get_session)):
    user, auth_token = auth.register(session, body.name, body.email, body.password)
    return auth_out(user, auth_token.token)


@router.post("/login", response_model=AuthOut)
def login(body: LoginIn, session: Session = Depends(get_session)):
    user, auth_token = auth.log_in(session, body.email, body.password)
    return auth_out(user, auth_token.token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return UserOut.model_validate(user)


@router.post("/logout", status_code=204)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> None:
    auth.log_out(session, credentials.credentials)
