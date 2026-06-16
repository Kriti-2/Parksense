from pydantic import BaseModel


class RecidivismZone(BaseModel):
    zone: str
    recurrence_rate: float
    total_violations: int
    repeat_offenders: int
    is_stubborn_zone: bool
    recommendation: str
    latitude: float
    longitude: float


class CorridorStatus(BaseModel):
    id: str
    name: str
    status: str
    active_violations: int
    priority_level: str
    zones: list[str]
    last_checked: str


class ShiftAssignment(BaseModel):
    zone: str
    officers_recommended: int
    priority: str
    shift: str
    expected_violations: int
    economic_impact_inr: float
