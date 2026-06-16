from pydantic import BaseModel, Field


class EconomicLossResult(BaseModel):
    zone: str
    loss_per_zone: float
    daily_loss: float
    weekly_loss: float
    monthly_loss: float
    vehicles_affected: int
    delay_minutes: float
    idle_fuel_cost: float
    productivity_loss: float


class ZoneCongestionMetrics(BaseModel):
    zone: str
    vehicles_affected: int
    delay_minutes: float
