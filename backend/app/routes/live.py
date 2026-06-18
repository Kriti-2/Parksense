from datetime import datetime

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.auth import require_ingest_auth
from app.config import get_settings
from app.middleware.rate_limit import limiter
from app.services.live_buffer import get_live_buffer
from app.services.realtime_engine import get_realtime_engine
from app.services.realtime_hub import get_realtime_hub
from app.utilities.constants import BENGALURU_ZONES
from app.utilities.geo_utils import assign_zone

router = APIRouter(tags=["Live"])


class ViolationIngest(BaseModel):
    latitude: float
    longitude: float
    vehicle_type: str = "CAR"
    violation_types: list[str] = Field(default_factory=lambda: ["NO PARKING"])
    zone: str | None = None
    near_intersection: bool = False


@router.get("/live/status")
@limiter.limit(lambda: get_settings().rate_limit_public)
def live_status(request: Request):
    return get_realtime_engine().get_status()


@router.websocket("/live/ws")
async def live_websocket(websocket: WebSocket):
    hub = get_realtime_hub()
    await hub.connect(websocket)
    try:
        engine = get_realtime_engine()
        await websocket.send_json(engine.get_status())
        if engine._last_tick:
            await websocket.send_json(engine._last_tick)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(websocket)


@router.post("/ingest/violation")
@limiter.limit(lambda: get_settings().rate_limit_ingest)
async def ingest_violation(
    request: Request,
    payload: ViolationIngest,
    _auth=Depends(require_ingest_auth),
):
    zone = payload.zone or assign_zone(payload.latitude, payload.longitude, BENGALURU_ZONES)
    row = get_live_buffer().ingest(
        {
            "id": f"ING-{datetime.utcnow().timestamp():.0f}",
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "zone": zone,
            "vehicle_type": payload.vehicle_type,
            "violation_types": payload.violation_types,
            "near_intersection": payload.near_intersection,
            "created_datetime": datetime.utcnow(),
        }
    )
    tick = get_realtime_engine().tick(manual_violation=row)
    await get_realtime_hub().broadcast(tick)
    return {"ingested": row, "live_tick": tick}
