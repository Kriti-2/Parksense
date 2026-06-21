import logging
from datetime import datetime, timezone

import httpx
import pandas as pd

from app.config import get_settings
from app.utilities.constants import BENGALURU_ZONES

logger = logging.getLogger(__name__)


class TrafficService:
    """Fetch live corridor speeds for Bengaluru zones."""

    def __init__(self):
        self._settings = get_settings()
        self._last_speeds: dict[str, float] = {}
        self._last_source: str = "unknown"
        self._last_updated: str | None = None

    @property
    def last_meta(self) -> dict:
        return {
            "source": self._last_source,
            "updated_at": self._last_updated,
            "zones": len(self._last_speeds),
        }

    def get_zone_speeds(self, recent_violations: pd.DataFrame | None = None) -> dict[str, float]:
        speeds: dict[str, float] | None = None

        if self._settings.google_maps_api_key:
            speeds = self._fetch_google_maps_speeds()

        if speeds is None and self._settings.tomtom_api_key:
            speeds = self._fetch_tomtom_speeds()

        if speeds is None:
            speeds = self._density_based_speeds(recent_violations)
            self._last_source = "violation_density_model"
        else:
            self._last_source = "live_traffic_api"

        self._last_speeds = speeds
        self._last_updated = datetime.now(timezone.utc).isoformat()
        return speeds

    def _fetch_google_maps_speeds(self) -> dict[str, float] | None:
        key = self._settings.google_maps_api_key
        speeds = {}
        try:
            with httpx.Client(timeout=10.0) as client:
                for zone, meta in BENGALURU_ZONES.items():
                    lat, lon = meta["center"]
                    url = "https://maps.googleapis.com/maps/api/directions/json"
                    dest_lat, dest_lon = lat + 0.008, lon + 0.008
                    resp = client.get(
                        url,
                        params={
                            "origin": f"{lat},{lon}",
                            "destination": f"{dest_lat},{dest_lon}",
                            "departure_time": "now",
                            "traffic_model": "best_guess",
                            "key": key,
                        },
                    )
                    data = resp.json()
                    if data.get("status") != "OK" or not data.get("routes"):
                        continue
                    leg = data["routes"][0]["legs"][0]
                    duration = leg.get("duration_in_traffic", leg.get("duration", {}))
                    distance = leg.get("distance", {}).get("value", 1000)
                    seconds = duration.get("value", 60)
                    speed_kmh = (distance / 1000) / (seconds / 3600) if seconds > 0 else meta["baseline_speed_kmh"]
                    speeds[zone] = round(min(speed_kmh, meta["baseline_speed_kmh"]), 2)
            if speeds:
                self._last_source = "google_maps"
                return speeds
        except Exception as exc:
            logger.warning("Google Maps traffic fetch failed: %s", exc)
        return None

    def _fetch_tomtom_speeds(self) -> dict[str, float] | None:
        key = self._settings.tomtom_api_key
        speeds = {}
        try:
            with httpx.Client(timeout=10.0) as client:
                for zone, meta in BENGALURU_ZONES.items():
                    lat, lon = meta["center"]
                    url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
                    resp = client.get(url, params={"key": key, "point": f"{lat},{lon}"})
                    data = resp.json()
                    flow = data.get("flowSegmentData", {})
                    speed = flow.get("currentSpeed")
                    if speed is not None:
                        speeds[zone] = round(float(speed), 2)
            if speeds:
                self._last_source = "tomtom"
                return speeds
        except Exception as exc:
            logger.warning("TomTom traffic fetch failed: %s", exc)
        return None

    def _density_based_speeds(self, recent: pd.DataFrame | None) -> dict[str, float]:
        """
        Estimate speeds from real violation density in the recent window.
        More parking violations correlate with lower traffic speeds.
        """
        speeds = {}
        ref_hour = datetime.now(timezone.utc).hour

        # Calculate counts per zone to perform min-max scaling
        zone_counts = {}
        if recent is not None and not recent.empty and "zone" in recent.columns:
            for z in BENGALURU_ZONES:
                zone_counts[z] = len(recent[recent["zone"] == z])
            min_count = min(zone_counts.values()) if zone_counts else 0
            max_count = max(zone_counts.values()) if zone_counts else 1
            count_range = max_count - min_count if max_count - min_count > 0 else 1
        else:
            min_count = 0
            max_count = 1
            count_range = 1

        for zone, meta in BENGALURU_ZONES.items():
            baseline = meta["baseline_speed_kmh"]
            if recent is not None and not recent.empty and "zone" in recent.columns:
                zone_count = zone_counts.get(zone, 0)
                # Normalize between 0 and 1
                density_factor = (zone_count - min_count) / count_range
            else:
                density_factor = 0.4

            # Peak hour speed drop penalty
            peak_penalty = 0.15 if any(s <= ref_hour < e for s, e in [(8, 11), (17, 21)]) else 0.0
            drop = min(0.65, density_factor * 0.35 + peak_penalty)
            speeds[zone] = round(baseline * (1 - drop), 2)

        return speeds
