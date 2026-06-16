from datetime import datetime

import pandas as pd

from app.services.corridor_protector import GreenCorridorProtector
from app.utilities.constants import EMERGENCY_CORRIDORS
from app.utilities.time_context import filter_recent, get_reference_time


def build_corridors_response(df: pd.DataFrame, recent_only: bool = True) -> dict:
    working = df
    if recent_only and not df.empty:
        working = filter_recent(
            df,
            hours=24,
            reference=get_reference_time(df, use_wall_clock=True),
        )

    protector = GreenCorridorProtector()
    statuses = protector.evaluate(working)

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
