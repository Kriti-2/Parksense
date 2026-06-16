from datetime import datetime

from fastapi import APIRouter

from app.data.loader import get_data_store
from app.services.corridor_protector import GreenCorridorProtector
from app.utilities.constants import EMERGENCY_CORRIDORS

router = APIRouter(tags=["Corridors"])


@router.get("/corridors")
def get_corridors():
    store = get_data_store()
    df = store.load()
    protector = GreenCorridorProtector()
    statuses = protector.evaluate(df)

    corridor_geo = []
    for corridor, status in zip(EMERGENCY_CORRIDORS, statuses):
        corridor_geo.append(
            {
                **status.model_dump(),
                "waypoints": corridor["waypoints"],
                "geojson": {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[wp[1], wp[0]] for wp in corridor["waypoints"]],
                    },
                    "properties": {"id": corridor["id"], "name": corridor["name"]},
                },
            }
        )

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "corridors": corridor_geo,
        "summary": {
            "total": len(statuses),
            "blocked": sum(1 for s in statuses if s.status == "BLOCKED"),
            "degraded": sum(1 for s in statuses if s.status == "DEGRADED"),
            "clear": sum(1 for s in statuses if s.status == "CLEAR"),
        },
    }
