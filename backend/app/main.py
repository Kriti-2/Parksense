import asyncio
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.data.loader import get_data_store
from app.middleware.rate_limit import limiter
from app.database import SessionLocal, init_db
from app.routes import (
    analytics,
    auth,
    chat,
    corridors,
    heatmap,
    jobs,
    live,
    predictions,
    public,
    recidivism,
    severity,
    shift_planner,
    weather,
)
from app.services.realtime_engine import get_realtime_engine
from app.services.realtime_hub import get_realtime_hub

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def _refresh_data_cache():
    settings = get_settings()
    if settings.celery_enabled:
        from app.tasks.heavy_jobs import warm_caches_task

        logger.info("Dispatching warm_caches to Celery")
        warm_caches_task.delay(use_prophet=False)
        return

    logger.info("Scheduled data cache refresh (in-process)")
    store = get_data_store()
    store.load(force_reload=True)
    store.warm_caches()


def _live_tick():
    """Sync job: refresh live data and broadcast to WebSocket clients."""
    try:
        payload = get_realtime_engine().tick()
        hub = get_realtime_hub()
        asyncio.run(hub.broadcast(payload))
        logger.debug("Live tick broadcast to WebSocket clients")
    except Exception as exc:
        logger.warning("Live tick failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO)

    logger.info("Starting %s — preloading violation dataset", settings.app_name)
    if settings.celery_enabled:
        logger.info("Celery enabled — heavy jobs run via worker (%s)", settings.broker_url)
    if settings.auth_enabled:
        logger.info("Auth enabled — ingest and officer APIs are protected")

    init_db()
    db = SessionLocal()
    try:
        from app.routes.auth import seed_demo_users

        seed_demo_users(db)
    finally:
        db.close()

    import os
    store = get_data_store()
    if os.getenv("PYTEST_CURRENT_TEST"):
        store.load()
        store.warm_caches()
        get_realtime_engine().tick()
    else:
        def preload_and_warm():
            try:
                logger.info("Starting background preloading & cache warming...")
                store.load()
                store.warm_caches()
                get_realtime_engine().tick()
                logger.info("Background preloading & cache warming completed.")
            except Exception as exc:
                logger.error("Background preloading failed: %s", exc)

        import threading
        threading.Thread(target=preload_and_warm, daemon=True).start()

    import os
    if not os.getenv("PYTEST_CURRENT_TEST"):
        scheduler.add_job(_refresh_data_cache, "interval", hours=6, id="data_refresh")
        scheduler.add_job(
            _live_tick,
            "interval",
            seconds=settings.live_refresh_seconds,
            id="live_tick",
        )
        scheduler.start()
        logger.info(
            "APScheduler started (live refresh every %ds)",
            settings.live_refresh_seconds,
        )

    yield

    if not os.getenv("PYTEST_CURRENT_TEST"):
        scheduler.shutdown(wait=False)
        logger.info("Shutdown complete")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description=(
            "AI-powered parking congestion intelligence platform for Bengaluru. "
            "Detects hotspots, quantifies impact, forecasts violations, and prioritizes enforcement."
        ),
        version="1.2.0",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(chat.router)
    app.include_router(heatmap.router)
    app.include_router(analytics.router)
    app.include_router(predictions.router)
    app.include_router(severity.router)
    app.include_router(recidivism.router)
    app.include_router(corridors.router)
    app.include_router(shift_planner.router)
    app.include_router(live.router)
    app.include_router(jobs.router)
    app.include_router(public.router)
    app.include_router(weather.router)

    @app.get("/")
    @limiter.limit(lambda: get_settings().rate_limit_public)
    def root(request: Request):
        return {
            "app": settings.app_name,
            "version": "1.2.0",
            "live_mode": settings.live_mode,
            "auth_enabled": settings.auth_enabled,
            "celery_enabled": settings.celery_enabled,
            "tagline": (
                "Not just where violations happen — but what they cost, "
                "where they'll happen next, and exactly how many officers to deploy where."
            ),
            "endpoints": [
                "/auth/login",
                "/auth/ingest-token",
                "/heatmap",
                "/analytics",
                "/predictions",
                "/severity-queue",
                "/recidivism",
                "/corridors",
                "/shift-planner",
                "/live/status",
                "/live/ws",
                "/ingest/violation",
                "/jobs/warm-caches",
                "/jobs/prophet-forecast",
                "/weather",
                "/auth/register",
                "/auth/google/login",
                "/public/congestion-preview",
            ],
        }

    @app.get("/health")
    @limiter.exempt
    def health():
        store = get_data_store()
        df = store.load()
        live = get_realtime_engine().get_status()
        return {
            "status": "healthy",
            "violations_loaded": len(df),
            "auth_enabled": settings.auth_enabled,
            "celery_enabled": settings.celery_enabled,
            "live": live,
        }

    return app


app = create_app()
