from datetime import datetime, timezone

import pandas as pd

from app.models.congestion_fingerprint import CongestionFingerprintEngine, CongestionInput
from app.models.economic import ZoneCongestionMetrics
from app.services.economic_calculator import EconomicCalculator
from app.utilities.constants import BENGALURU_ZONES
from app.utilities.time_context import get_reference_time, violations_last_hour_count


def build_analytics_response(
    df: pd.DataFrame,
    zone_speeds: dict[str, float] | None = None,
    recent_df: pd.DataFrame | None = None,
    reference: pd.Timestamp | None = None,
    live: bool = False,
    traffic_meta: dict | None = None,
    trends_cache: list[dict] | None = None,
) -> dict:
    ref = reference or get_reference_time(df, use_wall_clock=live)
    recent = recent_df if recent_df is not None else df

    engine = CongestionFingerprintEngine()
    ts = datetime.now(timezone.utc)

    if zone_speeds:
        congestion_fps = [
            engine.compute(
                CongestionInput(corridor=zone, timestamp=ts, traffic_speed_kmh=speed)
            )
            for zone, speed in zone_speeds.items()
        ]
    else:
        congestion_fps = engine.compute_all_corridors(timestamp=ts, zone_speeds=zone_speeds)

    econ = EconomicCalculator()
    zone_metrics: list[ZoneCongestionMetrics] = []
    for fp in congestion_fps:
        zone_recent = len(recent[recent["zone"] == fp.corridor]) if not recent.empty else 0
        vehicles = max(int(zone_recent * 4), int(fp.speed_drop_pct * 10), 10)
        delay = round(max(fp.speed_drop_pct * 0.35, zone_recent * 0.5), 1)
        zone_metrics.append(
            ZoneCongestionMetrics(zone=fp.corridor, vehicles_affected=vehicles, delay_minutes=delay)
        )

    economic_losses = econ.calculate_all_zones(zone_metrics)
    total_daily = econ.total_daily_loss(economic_losses)

    zone_breakdown = _build_zone_breakdown(recent if live and not recent.empty else df)
    violation_trends = trends_cache if trends_cache is not None else _build_violation_trends(df, reference=ref)

    response = {
        "generated_at": ts.isoformat(),
        "live": live,
        "reference_time": ref.isoformat(),
        "kpis": {
            "total_violations": len(df),
            "violations_last_hour": violations_last_hour_count(recent, ref),
            "violations_last_24h": len(recent) if live else None,
            "active_hotspots": sum(1 for c in congestion_fps if c.congestion_score >= 50),
            "daily_economic_loss_inr": total_daily,
            "weekly_economic_loss_inr": round(total_daily * 7, 2),
            "monthly_economic_loss_inr": round(total_daily * 30, 2),
            "avg_congestion_score": round(
                sum(c.congestion_score for c in congestion_fps) / max(len(congestion_fps), 1), 2
            ),
        },
        "congestion_fingerprints": [c.model_dump(mode="json") for c in congestion_fps],
        "economic_losses": [e.model_dump() for e in economic_losses],
        "violation_trends": violation_trends,
        "zone_breakdown": zone_breakdown,
        "zone_breakdown_scope": "last_24h" if live else "all_time",
        "policy_recommendations": _policy_recommendations(congestion_fps, economic_losses, recent),
    }

    if live:
        response["data_sources"] = {
            "violations": "bengaluru_police_dataset + live_stream",
            "traffic": traffic_meta or {"source": "violation_density_model"},
            "congestion": "live_traffic_speeds" if zone_speeds else "density_model",
        }

    return response


def _build_violation_trends(df: pd.DataFrame, reference: pd.Timestamp | None = None, days: int = 14) -> list[dict]:
    if df.empty or "created_datetime" not in df.columns:
        return []

    working = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(working["created_datetime"]):
        working["created_datetime"] = pd.to_datetime(working["created_datetime"], utc=True, errors="coerce")
    working = working.dropna(subset=["created_datetime"])

    ref = reference or get_reference_time(working)
    cutoff = ref - pd.Timedelta(days=days)
    windowed = working[(working["created_datetime"] >= cutoff) & (working["created_datetime"] <= ref)]

    if windowed.empty:
        windowed = working.nlargest(days * 500, "created_datetime")

    daily = windowed.groupby(windowed["created_datetime"].dt.date).size().reset_index(name="violations")
    daily.columns = ["date", "violations"]
    daily["date"] = daily["date"].astype(str)
    return daily.tail(days).to_dict(orient="records")


def _build_zone_breakdown(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return [{"zone": z, "violations": 0, "share_pct": 0.0} for z in BENGALURU_ZONES]

    counts = df["zone"].value_counts().to_dict()
    total_in_zones = sum(counts.get(z, 0) for z in BENGALURU_ZONES) or 1
    return [
        {
            "zone": zone,
            "violations": counts.get(zone, 0),
            "share_pct": round(counts.get(zone, 0) / total_in_zones * 100, 2),
        }
        for zone in BENGALURU_ZONES
    ]


def _policy_recommendations(congestion, economic_losses, df: pd.DataFrame) -> list[dict]:
    recs = []
    worst = max(congestion, key=lambda c: c.congestion_score)
    recs.append(
        {
            "action": "Dynamic No-Parking Zones",
            "zone": worst.corridor,
            "priority": "HIGH",
            "rationale": f"Live congestion score {worst.congestion_score} with {worst.speed_drop_pct}% speed drop.",
        }
    )
    top_loss = max(economic_losses, key=lambda e: e.daily_loss)
    recs.append(
        {
            "action": "Peak-Hour Tow Enforcement",
            "zone": top_loss.zone,
            "priority": "CRITICAL",
            "rationale": f"Daily economic loss ₹{top_loss.daily_loss:,.0f} from parking-induced delays.",
        }
    )

    junction_zone = "Silk Board"
    if not df.empty and "near_intersection" in df.columns:
        junction_counts = df[df["near_intersection"]].groupby("zone").size()
        if not junction_counts.empty:
            junction_zone = str(junction_counts.idxmax())

    recs.append(
        {
            "action": "Smart Signage + CCTV at Intersections",
            "zone": junction_zone,
            "priority": "MEDIUM",
            "rationale": f"Highest junction-adjacent violation count in live window ({junction_zone}).",
        }
    )
    return recs
