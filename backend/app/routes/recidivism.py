from datetime import datetime

from fastapi import APIRouter

from app.data.loader import get_data_store
from app.services.recidivism_engine import RecidivismHeatmapEngine

router = APIRouter(tags=["Recidivism"])


@router.get("/recidivism")
def get_recidivism():
    store = get_data_store()
    df = store.load()
    engine = RecidivismHeatmapEngine()
    zones = engine.analyze(df)

    stubborn = [z for z in zones if z.is_stubborn_zone]

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "zones": [z.model_dump() for z in zones],
        "stubborn_zone_count": len(stubborn),
        "threshold_pct": engine.STUBBORN_THRESHOLD * 100,
    }
