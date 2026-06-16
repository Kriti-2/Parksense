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
    predictions,
    recidivism,
    severity,
    shift_planner,
)

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def _refresh_data_cache():
    logger.info("Scheduled data cache refresh")
    store = get_data_store()
    store.load(force_reload=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO)

    logger.info("Starting %s — preloading violation dataset", settings.app_name)
    get_data_store().load()

    scheduler.add_job(_refresh_data_cache, "interval", hours=6, id="data_refresh")
    scheduler.start()
    logger.info("APScheduler started")

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
        version="1.0.0",
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

    @app.get("/")
    def root():
        return {
            "app": settings.app_name,
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
            ],
        }

    @app.get("/health")
    def health():
        store = get_data_store()
        df = store.load()
        return {"status": "healthy", "violations_loaded": len(df)}

    return app


app = create_app()
