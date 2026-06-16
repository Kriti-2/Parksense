from datetime import datetime

from fastapi import APIRouter

from app.data.loader import get_data_store
from app.models.congestion_fingerprint import CongestionFingerprintEngine
from app.models.economic import ZoneCongestionMetrics
from app.models.forecaster import ParkPredictForecaster
from app.models.severity_classifier import ViolationSeverityClassifier
from app.models.severity_schemas import ViolationSeverityInput
from app.services.economic_calculator import EconomicCalculator
from app.services.shift_planner import ShiftPlannerService
from app.utilities.constants import BENGALURU_ZONES
import pandas as pd

router = APIRouter(tags=["Shift Planner"])


@router.get("/shift-planner")
def get_shift_planner():
    store = get_data_store()
    df = store.load()

    forecaster = ParkPredictForecaster()
    predictions = forecaster.forecast(df)

    engine = CongestionFingerprintEngine()
    congestion = engine.compute_all_corridors()
    econ = EconomicCalculator()
    zone_metrics = [
        ZoneCongestionMetrics(
            zone=fp.corridor,
            vehicles_affected=max(int(fp.speed_drop_pct * 12), 15),
            delay_minutes=round(fp.speed_drop_pct * 0.4, 1),
        )
        for fp in congestion
    ]
    economic_losses = econ.calculate_all_zones(zone_metrics)

    classifier = ViolationSeverityClassifier()
    severity_results = []
    if not df.empty:
        sample = df.head(100)
        for _, row in sample.iterrows():
            ts = row.get("created_datetime")
            hour = pd.to_datetime(ts).hour if pd.notna(ts) else 12
            zone = row.get("zone", "Unknown")
            severity_results.append(
                classifier.classify(
                    ViolationSeverityInput(
                        violation_id=str(row.get("id", "")),
                        zone=zone,
                        vehicle_type=str(row.get("vehicle_type", "CAR")),
                        lane_width_m=BENGALURU_ZONES.get(zone, {}).get("lane_width_m", 7.0),
                        hour=int(hour),
                        near_intersection=bool(row.get("near_intersection", False)),
                        violation_types=row.get("violation_types", []),
                    )
                )
            )

    planner = ShiftPlannerService()
    assignments = planner.plan(predictions, economic_losses, severity_results)

    total_officers = sum(a.officers_recommended for a in assignments)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "assignments": [a.model_dump() for a in assignments],
        "summary": {
            "total_officers_recommended": total_officers,
            "critical_zones": sum(1 for a in assignments if a.priority == "CRITICAL"),
            "high_priority_zones": sum(1 for a in assignments if a.priority == "HIGH"),
            "total_expected_violations": sum(a.expected_violations for a in assignments),
            "total_economic_impact_inr": round(sum(a.economic_impact_inr for a in assignments), 2),
        },
    }
