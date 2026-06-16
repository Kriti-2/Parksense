from app.config import get_settings
from app.models.economic import EconomicLossResult, ZoneCongestionMetrics


class EconomicCalculator:
    """
    Convert parking-induced congestion into rupee loss.

    Economic Loss =
        (idle fuel cost × vehicles affected × delay minutes)
        + (hourly wage / 60 × delay minutes × vehicles affected)
    """

    def __init__(self):
        settings = get_settings()
        self.fuel_burn_lph = settings.fuel_burn_lph
        self.fuel_cost_per_l = settings.fuel_cost_per_l
        self.average_wage_per_hour = settings.average_wage_per_hour

    def idle_fuel_cost_per_vehicle_minute(self) -> float:
        return (self.fuel_burn_lph / 60) * self.fuel_cost_per_l

    def productivity_loss_per_vehicle_minute(self) -> float:
        return self.average_wage_per_hour / 60

    def calculate_zone_loss(self, metrics: ZoneCongestionMetrics) -> EconomicLossResult:
        vehicles = max(metrics.vehicles_affected, 1)
        delay = max(metrics.delay_minutes, 0.0)

        idle_fuel = self.idle_fuel_cost_per_vehicle_minute() * vehicles * delay
        productivity = self.productivity_loss_per_vehicle_minute() * delay * vehicles
        loss_per_zone = idle_fuel + productivity

        return EconomicLossResult(
            zone=metrics.zone,
            loss_per_zone=round(loss_per_zone, 2),
            daily_loss=round(loss_per_zone, 2),
            weekly_loss=round(loss_per_zone * 7, 2),
            monthly_loss=round(loss_per_zone * 30, 2),
            vehicles_affected=vehicles,
            delay_minutes=round(delay, 2),
            idle_fuel_cost=round(idle_fuel, 2),
            productivity_loss=round(productivity, 2),
        )

    def calculate_all_zones(self, metrics_list: list[ZoneCongestionMetrics]) -> list[EconomicLossResult]:
        return [self.calculate_zone_loss(m) for m in metrics_list]

    def total_daily_loss(self, results: list[EconomicLossResult]) -> float:
        return round(sum(r.daily_loss for r in results), 2)
