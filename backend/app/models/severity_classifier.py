from app.models.congestion_fingerprint import CongestionFingerprintEngine
from app.models.severity_schemas import (
    SeverityLevel,
    ViolationSeverityInput,
    ViolationSeverityResult,
)
from app.utilities.constants import BENGALURU_ZONES, VEHICLE_SEVERITY_WEIGHTS


class ViolationSeverityClassifier:
    """Classify parking violations as LOW, MEDIUM, or CRITICAL."""

    def classify(self, data: ViolationSeverityInput) -> ViolationSeverityResult:
        vehicle_weight = VEHICLE_SEVERITY_WEIGHTS.get(data.vehicle_type.upper(), 0.55)
        lane_width = data.lane_width_m or BENGALURU_ZONES.get(data.zone, {}).get("lane_width_m", 7.0)

        lane_factor = 1.0 if lane_width <= 6.0 else (0.7 if lane_width <= 7.0 else 0.5)
        peak_factor = 1.0 if CongestionFingerprintEngine.is_peak_hour(data.hour) else 0.6
        intersection_factor = 1.0 if data.near_intersection else 0.55
        multi_violation_factor = min(1.0, 0.5 + len(data.violation_types) * 0.15)

        score = (
            vehicle_weight * 35
            + lane_factor * 25
            + peak_factor * 20
            + intersection_factor * 15
            + multi_violation_factor * 5
        )
        score = min(100.0, score)

        if score >= 70:
            severity = SeverityLevel.CRITICAL
        elif score >= 45:
            severity = SeverityLevel.MEDIUM
        else:
            severity = SeverityLevel.LOW

        return ViolationSeverityResult(
            violation_id=data.violation_id,
            zone=data.zone,
            vehicle_type=data.vehicle_type,
            severity=severity,
            severity_score=round(score, 2),
            factors={
                "vehicle_weight": round(vehicle_weight, 2),
                "lane_width_m": lane_width,
                "lane_factor": round(lane_factor, 2),
                "peak_hour": CongestionFingerprintEngine.is_peak_hour(data.hour),
                "peak_factor": round(peak_factor, 2),
                "near_intersection": data.near_intersection,
                "intersection_factor": round(intersection_factor, 2),
                "violation_count": len(data.violation_types),
            },
        )

    def classify_batch(self, items: list[ViolationSeverityInput]) -> list[ViolationSeverityResult]:
        return [self.classify(item) for item in items]
