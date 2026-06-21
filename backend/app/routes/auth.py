import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.schemas import (
    TokenResponse,
    UserLogin,
    UserOut,
    UserRegister,
    LoginRequest,
    ForgotPasswordRequest,
    VerifyOTPRequest,
    ResetPasswordRequest,
)
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
            email=f"{settings.officer_username}@margsense.local",
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
        email=f"{body.username}@margsense.local",
        full_name="Ingestion Client",
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password")
@limiter.limit(lambda: get_settings().rate_limit_auth)
def forgot_password(
    request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)
):
    """Generate and send a password reset OTP code to the user's email."""
    import random
    from datetime import datetime, timedelta
    from app.services.email_service import send_otp_email

    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Email not found"
        )

    # Generate 6-digit numeric OTP
    otp = f"{random.randint(100000, 999999)}"
    user.otp_code = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    # Dispatch email (fallback to log/file if not configured)
    send_otp_email(user.email, otp)

    return {"message": "OTP code has been sent to your email"}


@router.post("/verify-otp")
@limiter.limit(lambda: get_settings().rate_limit_auth)
def verify_otp(
    request: Request, payload: VerifyOTPRequest, db: Session = Depends(get_db)
):
    """Verify that the OTP code is valid and not expired."""
    from datetime import datetime

    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if not user.otp_code or user.otp_code != payload.otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP code"
        )

    if not user.otp_expires_at or user.otp_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="OTP code has expired"
        )

    return {"message": "OTP code is valid"}


@router.post("/reset-password")
@limiter.limit(lambda: get_settings().rate_limit_auth)
def reset_password(
    request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)
):
    """Verify OTP and reset the user's password."""
    from datetime import datetime

    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if not user.otp_code or user.otp_code != payload.otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP code"
        )

    if not user.otp_expires_at or user.otp_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="OTP code has expired"
        )

    # Update password and clear OTP
    user.hashed_password = hash_password(payload.new_password)
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()

    return {"message": "Password has been reset successfully"}





def seed_demo_users(db: Session) -> None:
    """Create demo accounts for hackathon demos."""
    demos = [
        ("user@margsense.demo", "User Demo", "user123", UserRole.USER),
        ("officer@margsense.demo", "Officer Demo", "officer123", UserRole.OFFICER),
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
    logger.info("Demo users seeded (user@margsense.demo / officer@margsense.demo)")
