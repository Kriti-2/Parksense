import logging
from urllib.parse import urlencode

from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.schemas import TokenResponse, UserLogin, UserOut, UserRegister, LoginRequest
from app.auth.security import create_access_token, hash_password, verify_password
from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole
from app.middleware.rate_limit import limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


def _token_response(user: User) -> TokenResponse:
    token = create_access_token({"sub": user.email, "role": user.role.value})
    return TokenResponse(
        access_token=token,
        role=user.role.value,
        full_name=user.full_name,
        email=user.email,
    )


@router.post("/register", response_model=TokenResponse)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """Public user registration — plan routes and avoid congestion hotspots."""
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=UserRole.USER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Email/password login for users and officers."""
    identifier = payload.email or payload.username
    if not identifier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or username is required")

    # 1. Try database auth
    user = db.query(User).filter(User.email == identifier.lower()).first()
    if user:
        if not verify_password(payload.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account disabled")
        return _token_response(user)

    # 2. Fall back to configuration-based auth (for unit tests / legacy integration)
    settings = get_settings()
    if identifier == settings.officer_username and payload.password == settings.officer_password:
        token = create_access_token({"sub": settings.officer_username, "role": "officer"})
        return TokenResponse(
            access_token=token,
            role="officer",
            expires_in_minutes=settings.jwt_expire_minutes,
            email=f"{settings.officer_username}@parksense.local",
            full_name="Config Officer",
        )

    # 3. If neither, unauthorized
    raise HTTPException(status_code=401, detail="Invalid credentials")



@router.post("/ingest-token", response_model=TokenResponse)
@limiter.limit(lambda: get_settings().rate_limit_auth)
def ingest_token(request: Request, body: LoginRequest):
    """Issue a JWT for BTP/SCITA ingest when API keys cannot be used."""
    settings = get_settings()
    if body.username != settings.ingest_username or body.password != settings.ingest_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": body.username, "role": "ingest"})
    return TokenResponse(
        access_token=token,
        role="ingest",
        expires_in_minutes=settings.jwt_expire_minutes,
        email=f"{body.username}@parksense.local",
        full_name="Ingestion Client",
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/google/login")
async def google_login(request: Request):
    """User OAuth — redirects to Google sign-in."""
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured. Use user demo login or set GOOGLE_CLIENT_ID.",
        )
    redirect_uri = settings.google_redirect_uri
    client = AsyncOAuth2Client(
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        redirect_uri=redirect_uri,
    )
    uri, _ = client.create_authorization_url(
        "https://accounts.google.com/o/oauth2/v2/auth",
        scope="openid email profile",
    )
    return RedirectResponse(uri)


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Google OAuth callback — creates or logs in user accounts."""
    settings = get_settings()
    frontend = settings.frontend_url.rstrip("/")

    if error:
        logger.warning("Google OAuth denied: %s", error)
        return RedirectResponse(f"{frontend}/login?error=google_oauth_denied")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")

    client = AsyncOAuth2Client(
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        redirect_uri=settings.google_redirect_uri,
    )
    try:
        await client.fetch_token(
            "https://oauth2.googleapis.com/token",
            code=code,
        )
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
        )
    except Exception as exc:
        logger.exception("Google OAuth token exchange failed: %s", exc)
        return RedirectResponse(f"{frontend}/login?error=google_oauth_failed")

    profile = resp.json()
    email = profile.get("email", "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            full_name=profile.get("name", "User"),
            role=UserRole.USER,
            oauth_provider="google",
            oauth_subject=profile.get("sub"),
        )
        db.add(user)
    else:
        user.oauth_provider = "google"
        user.oauth_subject = profile.get("sub")
    db.commit()
    db.refresh(user)

    access = create_access_token({"sub": user.email, "role": user.role.value})
    params = urlencode({"token": access, "role": user.role.value})
    return RedirectResponse(f"{frontend}/auth/callback?{params}")


def seed_demo_users(db: Session) -> None:
    """Create demo accounts for hackathon demos."""
    demos = [
        ("user@parksense.demo", "User Demo", "user123", UserRole.USER),
        ("officer@parksense.demo", "Officer Demo", "officer123", UserRole.OFFICER),
    ]
    for email, name, password, role in demos:
        if not db.query(User).filter(User.email == email).first():
            db.add(
                User(
                    email=email,
                    full_name=name,
                    hashed_password=hash_password(password),
                    role=role,
                )
            )
    db.commit()
    logger.info("Demo users seeded (user@parksense.demo / officer@parksense.demo)")
