import logging
from typing import Any

from app.celery_app import celery_app
from app.data.loader import get_data_store

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.heavy_jobs.warm_caches_task", bind=True)
def warm_caches_task(self, use_prophet: bool = False) -> dict[str, Any]:
    """Reload dataset and rebuild API caches off the request path."""
    logger.info("Celery warm_caches_task started (prophet=%s)", use_prophet)
    store = get_data_store()
    store.load(force_reload=True)
    if use_prophet:
        store.warm_forecast_prophet()
    store.warm_caches()
    df = store.load()
    return {
        "status": "completed",
        "violations_loaded": len(df),
        "use_prophet": use_prophet,
    }


@celery_app.task(name="app.tasks.heavy_jobs.prophet_forecast_task", bind=True)
def prophet_forecast_task(self) -> dict[str, Any]:
    """Run Prophet forecasting for all zones (CPU-heavy)."""
    logger.info("Celery prophet_forecast_task started")
    store = get_data_store()
    forecast = store.warm_forecast_prophet()
    return {
        "status": "completed",
        "zones_forecast": len(getattr(forecast, "predictions", []) or []),
        "model": getattr(forecast, "model", "prophet"),
    }


@celery_app.task(name="app.tasks.heavy_jobs.short_term_forecast_task", bind=True)
def short_term_forecast_task(self) -> dict[str, Any]:
    """Run sub-hourly ML forecasting for all zones."""
    logger.info("Celery short_term_forecast_task started")
    store = get_data_store()
    forecast = store.warm_short_term_forecast()
    return {
        "status": "completed",
        "zones_forecast": len(getattr(forecast, "predictions", []) or []),
        "model": "RandomForestRegressor",
    }


def get_task_result(task_id: str) -> dict[str, Any]:

    result = celery_app.AsyncResult(task_id)
    payload: dict[str, Any] = {
        "task_id": task_id,
        "status": result.status,
    }
    if result.successful():
        payload["result"] = result.result
    elif result.failed():
        payload["error"] = str(result.result)
    return payload
