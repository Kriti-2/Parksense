from fastapi import APIRouter, Request

from app.config import get_settings
from app.data.loader import get_data_store
from app.middleware.rate_limit import limiter

router = APIRouter(tags=["Predictions"])


@router.get("/predictions")
@limiter.limit(lambda: get_settings().rate_limit_public)
def get_predictions(request: Request):
    store = get_data_store()
    result = store.get_forecast()
    return result.model_dump(mode="json")


@router.get("/predictions/short-term")
@limiter.limit(lambda: get_settings().rate_limit_public)
def get_short_term_predictions(request: Request):
    store = get_data_store()
    result = store.get_short_term_forecast()
    return result.model_dump(mode="json")

