import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def auth_client(monkeypatch):
    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("JWT_SECRET", "test-secret-key")
    monkeypatch.setenv("CELERY_ENABLED", "false")
    monkeypatch.setenv("INGEST_API_KEY", "test-ingest-key")
    monkeypatch.setenv("OFFICER_USERNAME", "officer")
    monkeypatch.setenv("OFFICER_PASSWORD", "test-pass")
    monkeypatch.setenv("INGEST_USERNAME", "btp-ingest")
    monkeypatch.setenv("INGEST_PASSWORD", "ingest-pass")
    monkeypatch.setenv("WEATHER_API_KEY", "")
    monkeypatch.setenv("TOMTOM_API_KEY", "")
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "")
    # Ensure test database starts clean
    from pathlib import Path
    test_db_path = Path(__file__).resolve().parent.parent / "data" / "test.db"
    if test_db_path.exists():
        try:
            test_db_path.unlink()
        except Exception:
            pass

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{test_db_path}")

    from app.config import get_settings

    get_settings.cache_clear()

    from app.main import create_app

    with TestClient(create_app()) as client:
        yield client

    get_settings.cache_clear()


@pytest.fixture
def officer_token(auth_client):
    response = auth_client.post(
        "/auth/login",
        json={"username": "officer", "password": "test-pass"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]
