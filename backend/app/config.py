from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "मार्ग Sense"
    app_env: str = "development"
    debug: bool = True
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'margsense.db'}"

    violations_csv_path: str = str(
        BASE_DIR.parent / "jan to may police violation_anonymized791b166 (2).csv"
    )

    fuel_burn_lph: float = 0.5
    fuel_cost_per_l: float = 103.0
    average_wage_per_hour: float = 350.0

    weather_api_key: str = ""
    weather_city: str = "Bengaluru,IN"
    google_maps_api_key: str = ""
    tomtom_api_key: str = ""

    # SMTP Settings
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_from_email: str = "noreply@parksense.ai"

    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    gemini_api_key: str = ""

    frontend_url: str = "http://localhost:5173"

    live_mode: bool = True
    live_replay_enabled: bool = True
    live_replay_batch_size: int = 2
    live_refresh_seconds: int = 30

    # Phase 2 — auth
    auth_enabled: bool = False
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    ingest_api_key: str = ""
    officer_username: str = "officer"
    officer_password: str = "margsense-demo"
    ingest_username: str = "btp-ingest"
    ingest_password: str = "margsense-ingest"

    # Phase 2 — rate limits (slowapi format)
    rate_limit_public: str = "120/minute"
    rate_limit_ingest: str = "60/minute"
    rate_limit_officer: str = "100/minute"
    rate_limit_auth: str = "20/minute"

    # Phase 2 — Celery / Redis
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = ""
    celery_result_backend: str = ""
    celery_enabled: bool = False

    @property
    def broker_url(self) -> str:
        return self.celery_broker_url or self.redis_url

    @property
    def result_backend(self) -> str:
        return self.celery_result_backend or self.redis_url

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
