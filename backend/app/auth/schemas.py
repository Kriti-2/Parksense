from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.user import UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)


class UserLogin(BaseModel):
    email: str | None = None
    username: str | None = None
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str | UserRole
    expires_in_minutes: int | None = None
    full_name: str | None = None
    email: str | None = None


class TokenPayload(BaseModel):
    sub: str
    role: str = Field(description="ingest | officer | admin | user")
    full_name: str | None = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    eco_co2_offset: float | None = 0.0
    eco_fuel_saved: float | None = 0.0
    eco_time_saved: float | None = 0.0

    @field_validator("eco_co2_offset", "eco_fuel_saved", "eco_time_saved", mode="before")
    @classmethod
    def default_none_to_zero(cls, v):
        return v if v is not None else 0.0

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6)


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=6, max_length=128)

