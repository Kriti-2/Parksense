import json
import logging
from functools import lru_cache
from pathlib import Path

import pandas as pd

from app.config import BASE_DIR, get_settings
from app.utilities.constants import BENGALURU_ZONES
from app.utilities.geo_utils import assign_zone

logger = logging.getLogger(__name__)


class ViolationDataStore:
    """Load and cache Bengaluru parking violation dataset."""

    _instance: "ViolationDataStore | None" = None
    _df: pd.DataFrame | None = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load(self, force_reload: bool = False) -> pd.DataFrame:
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
        self._df = self._generate_mock_data()
        return self._df

    def _enrich(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
        df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
        df["zone"] = self._assign_zones_vectorized(df)
        if "updated_vehicle_type" in df.columns:
            df["vehicle_type"] = df["updated_vehicle_type"].fillna(df["vehicle_type"])
        df["vehicle_type"] = df["vehicle_type"].fillna("CAR")
        df["violation_types"] = df.get("violation_type", "[]").apply(self._parse_violation_types)
        df["near_intersection"] = df.get("junction_name", "No Junction").apply(
            lambda j: isinstance(j, str) and j.strip().lower() != "no junction"
        )
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
