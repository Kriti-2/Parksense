from datetime import datetime

from pydantic import BaseModel, Field


class PredictionZone(BaseModel):
    rank: int
    zone: str
    risk_score: float = Field(..., ge=0, le=100)
    predicted_violations: int
    peak_hour: int
    confidence: float = Field(..., ge=0, le=1)
    latitude: float
    longitude: float
    drivers: list[str] = Field(default_factory=list)
    weather_boosted: bool = False


class ForecastResponse(BaseModel):
    generated_at: datetime
    horizon_hours: int = 24
    top_risk_zones: list[PredictionZone]
    model: str = "Prophet"
    weather_escalation: dict | None = None
class ShortTermPredictionZone(BaseModel):
    zone: str
    current_violations: int
    predicted_15m: int
    predicted_30m: int
    confidence: float
    latitude: float
    longitude: float


class ShortTermForecastResponse(BaseModel):
    generated_at: datetime
    interval_minutes: int = 15
    predictions: list[ShortTermPredictionZone]
