import hashlib
import hmac
import secrets

from sqlmodel import Session, select

from app.errors import ApiError
from app.models import AuthToken, User


def hash_password(password: str) -> str:
    """scrypt hash stored as "scrypt$<salt hex>$<hash hex>", the same format seed.py uses."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """True if the password matches the stored hash."""
    algorithm, salt_hex, digest_hex = stored.split("$")
    if algorithm != "scrypt":
        return False
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1, dklen=32)
    return hmac.compare_digest(digest, bytes.fromhex(digest_hex))


def issue_token(session: Session, user: User) -> AuthToken:
    """Start a new login session for the user."""
    auth_token = AuthToken(token=secrets.token_urlsafe(32), user_id=user.id)
    session.add(auth_token)
    session.commit()
    session.refresh(auth_token)
    return auth_token


def register(session: Session, name: str, email: str, password: str) -> tuple[User, AuthToken]:
    """Create a visitor account and log them in."""
    email = email.lower()
    if session.exec(select(User).where(User.email == email)).first():
        raise ApiError(409, "email_taken", "That email is already registered.", {"email": "Already registered."})

    user = User(name=name, email=email, password_hash=hash_password(password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user, issue_token(session, user)


def log_in(session: Session, email: str, password: str) -> tuple[User, AuthToken]:
    """Check the credentials and start a new login session."""
    user = session.exec(select(User).where(User.email == email.lower())).first()
    if user is None or not verify_password(password, user.password_hash):
        raise ApiError(401, "unauthorized", "Incorrect email or password.")
    return user, issue_token(session, user)


def log_out(session: Session, token: str) -> None:
    """End this login session. The user's other sessions stay active."""
    auth_token = session.get(AuthToken, token)
    if auth_token is not None:
        session.delete(auth_token)
        session.commit()
