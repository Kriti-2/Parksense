from datetime import datetime

from fastapi import APIRouter

from app.data.loader import get_data_store
from app.models.congestion_fingerprint import CongestionFingerprintEngine
from app.services.economic_calculator import EconomicCalculator
from app.models.economic import ZoneCongestionMetrics

router = APIRouter(tags=["Heatmap"])


@router.get("/heatmap")
def get_heatmap(limit: int = 2000):
    store = get_data_store()
    df = store.sample_for_heatmap(limit=limit)

    features = []
    for _, row in df.iterrows():
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row["longitude"]), float(row["latitude"])],
                },
                "properties": {
                    "id": str(row.get("id", "")),
                    "zone": row.get("zone", "Unknown"),
                    "vehicle_type": str(row.get("vehicle_type", "UNKNOWN")),
                    "violation_types": row.get("violation_types", []),
                    "timestamp": str(row.get("created_datetime", "")),
                },
            }
        )

    engine = CongestionFingerprintEngine()
    congestion = engine.compute_all_corridors()

    zone_intensity = {}
    for fp in congestion:
        zone_intensity[fp.corridor] = {
            "congestion_score": fp.congestion_score,
            "speed_drop_pct": fp.speed_drop_pct,
            "level": fp.congestion_level.value,
        }

    return {
        "type": "FeatureCollection",
        "generated_at": datetime.utcnow().isoformat(),
        "features": features,
        "zone_intensity": zone_intensity,
        "total_points": len(features),
    }
