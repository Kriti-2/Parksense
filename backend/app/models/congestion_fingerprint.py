from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.models.congestion_input import CongestionInput
from app.utilities.constants import BENGALURU_ZONES, PEAK_HOURS


class CongestionLevel(str, Enum):
    NORMAL = "NORMAL"
    MODERATE = "MODERATE"
    HEAVY = "HEAVY"
    SEVERE = "SEVERE"


class CongestionFingerprint(BaseModel):
    corridor: str
    timestamp: datetime
    baseline_speed_kmh: float = Field(..., description="Normal traffic speed for corridor")
    current_speed_kmh: float = Field(..., description="Current observed speed")
    speed_drop_pct: float = Field(..., description="Percentage drop from baseline")
    congestion_score: float = Field(..., ge=0, le=100, description="0-100 congestion score")
    congestion_level: CongestionLevel


class CongestionFingerprintEngine:
    """Calculate normal traffic baseline per corridor and derive congestion scores."""

    def __init__(self, zone_baselines: dict | None = None):
        self._baselines = zone_baselines or {
            name: meta["baseline_speed_kmh"] for name, meta in BENGALURU_ZONES.items()
        }

    def get_baseline(self, corridor: str) -> float:
        return self._baselines.get(corridor, 25.0)

    def compute(self, data: CongestionInput) -> CongestionFingerprint:
        baseline = self.get_baseline(data.corridor)
        current = max(data.traffic_speed_kmh, 1.0)
        speed_drop = max(0.0, ((baseline - current) / baseline) * 100)
        congestion_score = min(100.0, speed_drop * 1.2)

        if congestion_score >= 75:
            level = CongestionLevel.SEVERE
        elif congestion_score >= 50:
            level = CongestionLevel.HEAVY
        elif congestion_score >= 25:
            level = CongestionLevel.MODERATE
        else:
            level = CongestionLevel.NORMAL

        return CongestionFingerprint(
            corridor=data.corridor,
            timestamp=data.timestamp,
            baseline_speed_kmh=round(baseline, 2),
            current_speed_kmh=round(current, 2),
            speed_drop_pct=round(speed_drop, 2),
            congestion_score=round(congestion_score, 2),
            congestion_level=level,
        )

    def compute_all_corridors(
        self,
        timestamp: datetime | None = None,
        zone_speeds: dict[str, float] | None = None,
    ) -> list[CongestionFingerprint]:
        ts = timestamp or datetime.utcnow()
        results = []
        for zone, meta in BENGALURU_ZONES.items():
            if zone_speeds and zone in zone_speeds:
                speed = zone_speeds[zone]
            else:
                speed = meta["baseline_speed_kmh"] * 0.65
            results.append(
                self.compute(
                    CongestionInput(
                        corridor=zone,
                        timestamp=ts,
                        traffic_speed_kmh=round(speed, 2),
                    )
                )
            )
        return results

    @staticmethod
    def is_peak_hour(hour: int) -> bool:
        return any(start <= hour < end for start, end in PEAK_HOURS)
