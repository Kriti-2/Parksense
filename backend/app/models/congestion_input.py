from datetime import datetime

from pydantic import BaseModel


class CongestionInput(BaseModel):
    corridor: str
    timestamp: datetime
    traffic_speed_kmh: float
