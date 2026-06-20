import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from app.config import BASE_DIR, get_settings
from app.utilities.constants import BENGALURU_ZONES
from app.utilities.geo_utils import assign_zone

logger = logging.getLogger(__name__)


class ViolationDataStore:
    """Load and cache Bengaluru parking violation dataset and derived API responses."""

    _instance: "ViolationDataStore | None" = None
    _df: pd.DataFrame | None = None
    _forecast_cache: Any = None
    _analytics_cache: dict | None = None
    _recidivism_cache: dict | None = None
    _shift_planner_cache: dict | None = None
    _heatmap_cache: dict | None = None
    _severity_cache: dict | None = None
    _corridors_cache: dict | None = None
    _trends_cache: list[dict] | None = None
    _caches_warmed: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load(self, force_reload: bool = False) -> pd.DataFrame:
        if force_reload:
            self._clear_derived_caches()

        if self._df is not None and not force_reload:
            return self._df

        settings = get_settings()
        csv_path = Path(settings.violations_csv_path)

        if not csv_path.is_absolute():
            csv_path = BASE_DIR / csv_path

        if csv_path.exists():
            logger.info("Loading violations from %s", csv_path)
            df = pd.read_csv(csv_path, low_memory=False)
            df = self._enrich(df)
            self._df = df
            return df

        logger.warning("CSV not found at %s — using seeded mock data.", csv_path)
        self._df = self._enrich(self._generate_mock_data())
        return self._df

    def _clear_derived_caches(self) -> None:
        self._forecast_cache = None
        self._analytics_cache = None
        self._recidivism_cache = None
        self._shift_planner_cache = None
        self._heatmap_cache = None
        self._severity_cache = None
        self._corridors_cache = None
        self._trends_cache = None
        self._caches_warmed = False

    def warm_caches(self) -> None:
        """Precompute expensive API responses once at startup (or on scheduled refresh)."""
        if self._caches_warmed:
            return

        logger.info("Warming API caches (forecast, analytics, recidivism, shift-planner)...")
        df = self.load()

        from app.models.forecaster import ParkPredictForecaster
        from app.services.analytics_service import build_analytics_response, _build_violation_trends
        from app.services.shift_planner import build_shift_planner_response
        from app.services.heatmap_service import build_heatmap_response
        from app.services.severity_service import build_severity_response
        from app.services.corridors_service import build_corridors_response
        from app.services.live_buffer import get_live_buffer
        from app.services.realtime_engine import get_realtime_engine
        from app.services.traffic_service import TrafficService
        from app.utilities.time_context import get_reference_time

        forecaster = ParkPredictForecaster(use_prophet=False)
        self._forecast_cache = forecaster.forecast(df)

        get_live_buffer().configure_replay_pool(df)
        rt = get_realtime_engine()
        recent = rt.recent_window(hours=24)
        traffic = TrafficService()
        speeds = traffic.get_zone_speeds(recent)
        ref = get_reference_time(df, use_wall_clock=True)
        self._trends_cache = _build_violation_trends(df, reference=ref)

        self._analytics_cache = build_analytics_response(
            df,
            zone_speeds=speeds,
            recent_df=recent,
            reference=ref,
            live=True,
            traffic_meta=traffic.last_meta,
            trends_cache=self._trends_cache,
        )
        self._recidivism_cache = self._build_recidivism_response(df)
        self._shift_planner_cache = build_shift_planner_response(df, self._forecast_cache)
        self._heatmap_cache = build_heatmap_response(df, limit=5000, zone_intensity=None, zone_speeds=speeds)
        self._severity_cache = build_severity_response(recent if not recent.empty else df, limit=30)
        self._corridors_cache = build_corridors_response(recent if not recent.empty else df, recent_only=False)
        self._caches_warmed = True
        logger.info("API caches warmed successfully")

    def warm_forecast_prophet(self):
        """Run Prophet model off the request path (Celery / scheduled job)."""
        from app.models.forecaster import ParkPredictForecaster

        df = self.load()
        logger.info("Running Prophet forecast for %d violations", len(df))
        forecaster = ParkPredictForecaster(use_prophet=True)
        self._forecast_cache = forecaster.forecast(df)
        if self._shift_planner_cache is not None:
            from app.services.shift_planner import build_shift_planner_response

            self._shift_planner_cache = build_shift_planner_response(df, self._forecast_cache)
        return self._forecast_cache

    def get_forecast(self):
        if self._forecast_cache is None:
            self.warm_caches()
        return self._forecast_cache

    def get_analytics(self) -> dict:
        if self._analytics_cache is None:
            self.warm_caches()
        return self._analytics_cache

    def get_recidivism(self) -> dict:
        if self._recidivism_cache is None:
            self.warm_caches()
        return self._recidivism_cache

    def get_shift_planner(self) -> dict:
        if self._shift_planner_cache is None:
            self.warm_caches()
        return self._shift_planner_cache

    def get_heatmap(self, limit: int = 5000) -> dict:
        from app.services.heatmap_service import build_heatmap_response

        if self._heatmap_cache is None:
            self.warm_caches()
        if limit == 5000:
            return self._heatmap_cache
        return build_heatmap_response(self.load(), limit=limit)

    def get_severity_queue(self, limit: int = 30) -> dict:
        from app.services.severity_service import build_severity_response

        if self._severity_cache is None:
            self.warm_caches()
        if limit == 30:
            return self._severity_cache
        return build_severity_response(self.load(), limit=limit)

    def get_corridors(self) -> dict:
        if self._corridors_cache is None:
            self.warm_caches()
        return self._corridors_cache

    def refresh_live_caches(
        self,
        recent_df: pd.DataFrame,
        zone_intensity: dict,
        corridors: dict,
        severity: dict,
        zone_speeds: dict[str, float] | None = None,
        traffic_meta: dict | None = None,
        reference: pd.Timestamp | None = None,
    ) -> None:
        """Update caches with live traffic and violation window."""
        from app.services.analytics_service import build_analytics_response
        from app.services.heatmap_service import build_heatmap_response
        from app.utilities.time_context import get_reference_time

        full_df = self.load()
        speeds = zone_speeds or {
            zone: meta.get("current_speed_kmh", 20.0) for zone, meta in zone_intensity.items()
        }
        ref = reference or get_reference_time(full_df, use_wall_clock=True)

        self._analytics_cache = build_analytics_response(
            full_df,
            zone_speeds=speeds,
            recent_df=recent_df,
            reference=ref,
            live=True,
            traffic_meta=traffic_meta,
            trends_cache=self._trends_cache,
        )
        self._corridors_cache = corridors
        self._severity_cache = severity
        self._heatmap_cache = build_heatmap_response(
            recent_df if not recent_df.empty else full_df,
            limit=5000,
            zone_intensity=zone_intensity,
        )

    @staticmethod
    def _build_recidivism_response(df: pd.DataFrame) -> dict:
        from datetime import datetime

        from app.services.recidivism_engine import RecidivismHeatmapEngine

        engine = RecidivismHeatmapEngine()
        zones = engine.analyze(df)
        stubborn = [z for z in zones if z.is_stubborn_zone]
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "zones": [z.model_dump() for z in zones],
            "stubborn_zone_count": len(stubborn),
            "threshold_pct": engine.STUBBORN_THRESHOLD * 100,
        }

    def _enrich(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
        df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
        df["zone"] = self._assign_zones_vectorized(df)
        if "updated_vehicle_type" in df.columns:
            df["vehicle_type"] = df["updated_vehicle_type"].fillna(df["vehicle_type"])
        df["vehicle_type"] = df["vehicle_type"].fillna("CAR")
        if "violation_types" in df.columns:
            df["violation_types"] = df["violation_types"].apply(
                lambda v: v if isinstance(v, list) else self._parse_violation_types(v)
            )
        elif "violation_type" in df.columns:
            df["violation_types"] = df["violation_type"].apply(self._parse_violation_types)
        else:
            df["violation_types"] = [[] for _ in range(len(df))]
        df["near_intersection"] = df.get("junction_name", "No Junction").apply(
            lambda j: isinstance(j, str) and j.strip().lower() != "no junction"
        )
        if "created_datetime" in df.columns:
            df["created_datetime"] = pd.to_datetime(df["created_datetime"], utc=True, errors="coerce")
        return df

    @staticmethod
    def _assign_zones_vectorized(df: pd.DataFrame) -> pd.Series:
        zones = pd.Series("Unknown", index=df.index)
        for name, meta in BENGALURU_ZONES.items():
            min_lat, min_lon, max_lat, max_lon = meta["bbox"]
            mask = (
                df["latitude"].between(min_lat, max_lat)
                & df["longitude"].between(min_lon, max_lon)
                & zones.eq("Unknown")
            )
            zones.loc[mask] = name

        unknown = zones.eq("Unknown")
        if unknown.any():
            for idx in df.index[unknown]:
                lat, lon = df.at[idx, "latitude"], df.at[idx, "longitude"]
                if pd.notna(lat) and pd.notna(lon):
                    zones.at[idx] = assign_zone(lat, lon, BENGALURU_ZONES)
        return zones

    @staticmethod
    def _parse_violation_types(raw) -> list[str]:
        if isinstance(raw, list):
            return raw
        if not isinstance(raw, str) or raw in ("NULL", "null", ""):
            return []
        try:
            return json.loads(raw.replace("'", '"'))
        except (json.JSONDecodeError, ValueError):
            return [raw.strip("[]\"' ")]

    def _generate_mock_data(self) -> pd.DataFrame:
        import random
        from datetime import datetime, timedelta

        random.seed(42)
        rows = []
        vehicle_types = ["CAR", "SCOOTER", "MOTOR CYCLE", "PASSENGER AUTO", "TANKER"]
        violation_types = ["NO PARKING", "WRONG PARKING", "DOUBLE PARKING"]

        for i in range(500):
            zone = random.choice(list(BENGALURU_ZONES.keys()))
            center = BENGALURU_ZONES[zone]["center"]
            ts = datetime.utcnow() - timedelta(hours=random.randint(0, 720))
            rows.append(
                {
                    "id": f"MOCK{i:05d}",
                    "latitude": center[0] + random.uniform(-0.01, 0.01),
                    "longitude": center[1] + random.uniform(-0.01, 0.01),
                    "zone": zone,
                    "vehicle_type": random.choice(vehicle_types),
                    "vehicle_number": f"KA{random.randint(10,99)}AB{random.randint(1000,9999)}",
                    "updated_vehicle_number": f"KA{random.randint(10,99)}AB{random.randint(1000,9999)}",
                    "violation_types": random.sample(violation_types, k=random.randint(1, 2)),
                    "created_datetime": ts.isoformat(),
                    "near_intersection": random.random() > 0.7,
                    "junction_name": "No Junction",
                }
            )
        return pd.DataFrame(rows)

    def get_zone_summary(self) -> dict:
        df = self.load()
        summary = df.groupby("zone").agg(
            violations=("id", "count"),
            avg_lat=("latitude", "mean"),
            avg_lon=("longitude", "mean"),
        ).reset_index()
        return summary.to_dict(orient="records")

    def sample_for_heatmap(self, limit: int = 2000) -> pd.DataFrame:
        df = self.load()
        if len(df) <= limit:
            return df.dropna(subset=["latitude", "longitude"])
        return df.dropna(subset=["latitude", "longitude"]).sample(n=limit, random_state=42)


@lru_cache
def get_data_store() -> ViolationDataStore:
    return ViolationDataStore()
