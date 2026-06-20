from fastapi import APIRouter, Query, Request

from app.config import get_settings
from app.data.loader import get_data_store
from app.middleware.rate_limit import limiter

router = APIRouter(tags=["Heatmap"])


@router.get("/heatmap")
@limiter.limit(lambda: get_settings().rate_limit_public)
def get_heatmap(request: Request, limit: int = Query(default=3000, le=10000)):
    store = get_data_store()
    return store.get_heatmap(limit=limit)
