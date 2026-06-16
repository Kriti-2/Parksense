from datetime import datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.data.loader import get_data_store
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
def live_status():
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
async def ingest_violation(payload: ViolationIngest):
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
    tick = get_realtime_engine().tick()
    await get_realtime_hub().broadcast(tick)
    return {"ingested": row, "live_tick": tick}
