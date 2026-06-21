import logging

from celery import Celery

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

celery_app = Celery(
    "parksense",
    broker=settings.broker_url,
    backend=settings.result_backend,
    include=["app.tasks.heavy_jobs"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1,
)

if settings.celery_enabled:
    celery_app.conf.beat_schedule = {
        "warm-caches-every-6h": {
            "task": "app.tasks.heavy_jobs.warm_caches_task",
            "schedule": 6 * 60 * 60,
            "kwargs": {"use_prophet": False},
        },
        "prophet-forecast-daily": {
            "task": "app.tasks.heavy_jobs.prophet_forecast_task",
            "schedule": 24 * 60 * 60,
        },
        "short-term-forecast-15m": {
            "task": "app.tasks.heavy_jobs.short_term_forecast_task",
            "schedule": 15 * 60,
        },
    }

