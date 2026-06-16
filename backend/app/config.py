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

    app_name: str = "ParkSense AI"
    app_env: str = "development"
    debug: bool = True
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'parksense.db'}"

    violations_csv_path: str = str(
        BASE_DIR.parent / "jan to may police violation_anonymized791b166 (2).csv"
    )

    fuel_burn_lph: float = 0.5
    fuel_cost_per_l: float = 103.0
    average_wage_per_hour: float = 350.0

    weather_api_key: str = ""
    google_maps_api_key: str = ""
    tomtom_api_key: str = ""

    live_mode: bool = True
    live_replay_enabled: bool = True
    live_replay_batch_size: int = 2
    live_refresh_seconds: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
