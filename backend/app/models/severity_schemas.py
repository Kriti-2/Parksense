from enum import Enum

from pydantic import BaseModel, Field


class SeverityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    CRITICAL = "CRITICAL"


class ViolationSeverityInput(BaseModel):
    violation_id: str
    zone: str
    vehicle_type: str
    lane_width_m: float = 7.0
    hour: int = Field(..., ge=0, le=23)
    near_intersection: bool = False
    latitude: float | None = None
    longitude: float | None = None
    violation_types: list[str] = Field(default_factory=list)


class ViolationSeverityResult(BaseModel):
    violation_id: str
    zone: str
    vehicle_type: str
    severity: SeverityLevel
    severity_score: float = Field(..., ge=0, le=100)
    factors: dict[str, float | bool | str | int]
