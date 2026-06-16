import asyncio
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.data.loader import get_data_store
from app.routes import (
    analytics,
    corridors,
    heatmap,
    live,
    predictions,
    recidivism,
    severity,
    shift_planner,
)
from app.services.realtime_engine import get_realtime_engine
from app.services.realtime_hub import get_realtime_hub

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def _refresh_data_cache():
    logger.info("Scheduled data cache refresh")
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
    store = get_data_store()
    store.load()
    store.warm_caches()

    get_realtime_engine().tick()

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
        version="1.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(heatmap.router)
    app.include_router(analytics.router)
    app.include_router(predictions.router)
    app.include_router(severity.router)
    app.include_router(recidivism.router)
    app.include_router(corridors.router)
    app.include_router(shift_planner.router)
    app.include_router(live.router)

    @app.get("/")
    def root():
        return {
            "app": settings.app_name,
            "version": "1.1.0",
            "live_mode": settings.live_mode,
            "tagline": (
                "Not just where violations happen — but what they cost, "
                "where they'll happen next, and exactly how many officers to deploy where."
            ),
            "endpoints": [
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
            ],
        }

    @app.get("/health")
    def health():
        store = get_data_store()
        df = store.load()
        live = get_realtime_engine().get_status()
        return {
            "status": "healthy",
            "violations_loaded": len(df),
            "live": live,
        }

    return app


app = create_app()
