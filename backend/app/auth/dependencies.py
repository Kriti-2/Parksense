from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.auth.schemas import TokenPayload
from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def _dev_officer() -> User:
    return User(
        id=0,
        email="officer@margsense.demo",
        full_name="Officer Demo",
        role=UserRole.OFFICER,
    )


def _dev_ingest() -> dict:
    return {"sub": "dev-ingest", "role": "ingest"}


def _user_from_token(credentials: HTTPAuthorizationCredentials, db: Session) -> User:
    settings = get_settings()
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.email == payload["sub"], User.is_active.is_(True)).first()
    if not user:
        if payload["sub"] == settings.officer_username:
            return User(
                id=0,
                email=settings.officer_username,
                full_name="Config Officer",
                role=UserRole.OFFICER,
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    settings = get_settings()
    if credentials:
        return _user_from_token(credentials, db)

    if not settings.auth_enabled:
        return _dev_officer()

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    settings = get_settings()
    if credentials:
        try:
            return _user_from_token(credentials, db)
        except HTTPException:
            return None

    if not settings.auth_enabled:
        return _dev_officer()

    return None


def require_officer(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.OFFICER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Officer access required")
    return user


def require_user(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.USER, UserRole.OFFICER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return user


# Bridge functions for legacy / local endpoints
async def require_officer_auth(
    user: User = Depends(require_officer),
) -> TokenPayload:
    return TokenPayload(sub=user.email, role=user.role.value, full_name=user.full_name)


async def require_ingest_auth(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    settings = get_settings()
    if not settings.auth_enabled:
        return _dev_ingest()

    if settings.ingest_api_key and x_api_key == settings.ingest_api_key:
        return {"sub": "ingest-api-key", "role": "ingest"}

    if credentials and credentials.scheme.lower() == "bearer":
        payload = decode_access_token(credentials.credentials)
        if payload and payload.get("role") in ("ingest", "admin", "officer"):
            return payload

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Valid X-API-Key or ingest JWT required",
        headers={"WWW-Authenticate": "Bearer"},
    )
