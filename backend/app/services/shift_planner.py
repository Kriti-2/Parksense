from app.models.responses import ShiftAssignment
from app.models.forecast_schemas import ForecastResponse
from app.models.economic import EconomicLossResult
from app.models.severity_schemas import SeverityLevel, ViolationSeverityResult


class ShiftPlannerService:
    """Recommend officer deployment based on risk, severity, and economic impact."""

    def plan(
        self,
        predictions: ForecastResponse,
        economic_losses: list[EconomicLossResult],
        severity_queue: list[ViolationSeverityResult],
    ) -> list[ShiftAssignment]:
        loss_by_zone = {e.zone: e.daily_loss for e in economic_losses}
        critical_by_zone: dict[str, int] = {}
        for item in severity_queue:
            if item.severity == SeverityLevel.CRITICAL:
                critical_by_zone[item.zone] = critical_by_zone.get(item.zone, 0) + 1

        assignments: list[ShiftAssignment] = []
        for pred in predictions.top_risk_zones:
            zone = pred.zone
            economic_impact = loss_by_zone.get(zone, pred.predicted_violations * 850)
            critical_count = critical_by_zone.get(zone, 0)

            officers = 1
            if pred.risk_score >= 80 or critical_count >= 3:
                officers = 4
                priority = "CRITICAL"
            elif pred.risk_score >= 60 or critical_count >= 1:
                officers = 3
                priority = "HIGH"
            elif pred.risk_score >= 40:
                officers = 2
                priority = "MEDIUM"
            else:
                priority = "LOW"

            shift = "Morning" if pred.peak_hour < 12 else "Evening"

            assignments.append(
                ShiftAssignment(
                    zone=zone,
                    officers_recommended=officers,
                    priority=priority,
                    shift=shift,
                    expected_violations=pred.predicted_violations,
                    economic_impact_inr=round(economic_impact, 2),
                )
            )

        priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        assignments.sort(key=lambda a: priority_order[a.priority])
        return assignments
