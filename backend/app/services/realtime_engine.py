import logging
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.config import get_settings
from app.data.loader import get_data_store
from app.models.congestion_fingerprint import CongestionFingerprintEngine, CongestionInput
from app.services.analytics_service import build_analytics_response
from app.services.corridors_service import build_corridors_response
from app.services.live_buffer import get_live_buffer
from app.services.severity_service import build_severity_response
from app.services.traffic_service import TrafficService
from app.utilities.time_context import filter_recent, get_reference_time, violations_last_hour_count

logger = logging.getLogger(__name__)

_traffic_service = TrafficService()


def get_traffic_service() -> TrafficService:
    return _traffic_service


class RealtimeEngine:
    """Orchestrates live data refresh: replay, traffic, corridor status."""

    def __init__(self):
        self._settings = get_settings()
        self._last_tick: dict[str, Any] = {}

    def get_last_tick(self) -> dict[str, Any]:
        if not self._last_tick:
            return self.tick()
        return self._last_tick


    def combined_dataframe(self) -> pd.DataFrame:
        store = get_data_store()
        base = store.load()
        live = get_live_buffer().to_dataframe()
        if live.empty:
            return base
        if "violation_types" not in live.columns and "violation_type" in live.columns:
            live["violation_types"] = live["violation_type"]
        return pd.concat([base, live], ignore_index=True)

    def recent_window(self, hours: int = 24) -> pd.DataFrame:
        df = self.combined_dataframe()
        use_wall = self._settings.live_mode
        ref = get_reference_time(df, use_wall_clock=use_wall)
        historical = filter_recent(df, hours=hours, reference=ref)
        live_recent = get_live_buffer().recent_dataframe(hours=hours)
        if live_recent.empty:
            return historical
        return pd.concat([historical, live_recent], ignore_index=True).drop_duplicates(
            subset=["id"], keep="last"
        )

    def tick(self, manual_violation: dict | None = None) -> dict[str, Any]:
        """Run one live update cycle: replay violations, refresh traffic, rebuild live snapshots."""
        settings = get_settings()
        store = get_data_store()
        buffer = get_live_buffer()

        new_violations = []
        if settings.live_replay_enabled:
            new_violations = buffer.replay_tick(count=settings.live_replay_batch_size)

        if manual_violation:
            new_violations.append(manual_violation)

        recent = self.recent_window(hours=24)
        speeds = _traffic_service.get_zone_speeds(recent)

        engine = CongestionFingerprintEngine()
        ts = datetime.now(timezone.utc)
        congestion = []
        zone_intensity = {}
        for zone, speed in speeds.items():
            fp = engine.compute(
                CongestionInput(corridor=zone, timestamp=ts, traffic_speed_kmh=speed)
            )
            congestion.append(fp.model_dump(mode="json"))
            zone_intensity[zone] = {
                "congestion_score": fp.congestion_score,
                "speed_drop_pct": fp.speed_drop_pct,
                "level": fp.congestion_level.value,
                "current_speed_kmh": fp.current_speed_kmh,
            }

        corridors = build_corridors_response(recent, recent_only=False)
        severity = build_severity_response(recent, limit=30)
        ref = get_reference_time(store.load(), use_wall_clock=settings.live_mode)

        analytics = build_analytics_response(
            store.load(),
            zone_speeds=speeds,
            recent_df=recent,
            reference=ref,
            live=True,
            traffic_meta=_traffic_service.last_meta,
        )

        payload = {
            "type": "live_tick",
            "timestamp": ts.isoformat(),
            "live_mode": settings.live_mode,
            "data_sources": {
                "violations": "bengaluru_police_dataset",
                "traffic": _traffic_service.last_meta,
                "replay": buffer.stats(),
            },
            "reference_time": ref.isoformat(),
            "kpis": {
                "violations_last_hour": violations_last_hour_count(recent, ref),
                "violations_last_24h": len(recent),
                "live_buffer_size": buffer.stats()["buffer_size"],
            },
            "zone_intensity": zone_intensity,
            "congestion_fingerprints": congestion,
            "corridors": corridors,
            "analytics": analytics,
            "severity_summary": severity.get("summary", {}),
            "severity_queue": severity.get("queue", [])[:8],
            "new_violations": [
                {
                    "id": v.get("id"),
                    "zone": v.get("zone"),
                    "vehicle_type": v.get("vehicle_type"),
                    "latitude": v.get("latitude"),
                    "longitude": v.get("longitude"),
                }
                for v in new_violations
            ],
        }

        # Attach weather data to live tick
        try:
            from app.services.weather_service import get_weather_service

            payload["weather"] = get_weather_service().get_weather().to_dict()
        except Exception:
            payload["weather"] = None

        self._last_tick = payload
        store.refresh_live_caches(
            recent,
            zone_intensity,
            corridors,
            severity,
            zone_speeds=speeds,
            traffic_meta=_traffic_service.last_meta,
            reference=ref,
        )
        return payload

    def get_status(self) -> dict[str, Any]:
        store = get_data_store()
        df = store.load()
        settings = get_settings()
        ref = get_reference_time(df, use_wall_clock=settings.live_mode)
        return {
            "live_mode": settings.live_mode,
            "live_replay_enabled": settings.live_replay_enabled,
            "refresh_interval_seconds": settings.live_refresh_seconds,
            "reference_time": ref.isoformat(),
            "violations_loaded": len(df),
            "traffic": _traffic_service.last_meta,
            "buffer": get_live_buffer().stats(),
            "last_tick": self._last_tick.get("timestamp"),
            "data_sources": {
                "violations": "Flipkart Gridlock — Bengaluru Police (anonymized)",
                "traffic_api": _traffic_service.last_meta.get("source"),
                "ingest_endpoint": "/ingest/violation",
                "websocket": "/live/ws",
            },
        }


_engine: RealtimeEngine | None = None


def get_realtime_engine() -> RealtimeEngine:
    global _engine
    if _engine is None:
        _engine = RealtimeEngine()
    return _engine
