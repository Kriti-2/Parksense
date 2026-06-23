import logging
import time
from datetime import datetime, timezone

import httpx
import pandas as pd

from app.config import get_settings
from app.utilities.constants import BENGALURU_ZONES

logger = logging.getLogger(__name__)


class TrafficService:
    """Fetch live corridor speeds for Bengaluru zones."""

    _last_speeds: dict[str, float] = {}
    _last_source: str = "unknown"
    _last_updated: str | None = None
    _cache_timestamp: float = 0
    _cache_ttl: float = 120.0  # 2 minutes cache TTL

    _tomtom_disabled_until: float = 0
    _google_disabled_until: float = 0

    def __init__(self):
        self._settings = get_settings()

    @property
    def last_meta(self) -> dict:
        return {
            "source": TrafficService._last_source,
            "updated_at": TrafficService._last_updated,
            "zones": len(TrafficService._last_speeds),
        }

    def get_zone_speeds(self, recent_violations: pd.DataFrame | None = None) -> dict[str, float]:
        now = time.time()
        # Check if class-level cache is valid
        if TrafficService._last_speeds and (now - TrafficService._cache_timestamp) < TrafficService._cache_ttl:
            logger.debug("Using cached traffic speeds")
            return TrafficService._last_speeds

        speeds: dict[str, float] | None = None

        if self._settings.google_maps_api_key and now > TrafficService._google_disabled_until:
            speeds = self._fetch_google_maps_speeds()

        if speeds is None and self._settings.tomtom_api_key and now > TrafficService._tomtom_disabled_until:
            speeds = self._fetch_tomtom_speeds()

        if speeds is None:
            speeds = self._density_based_speeds(recent_violations)
            TrafficService._last_source = "violation_density_model"
        else:
            TrafficService._last_source = "live_traffic_api"

        TrafficService._last_speeds = speeds
        TrafficService._last_updated = datetime.now(timezone.utc).isoformat()
        TrafficService._cache_timestamp = now
        return speeds

    def _fetch_google_maps_speeds(self) -> dict[str, float] | None:
        key = self._settings.google_maps_api_key
        speeds = {}
        try:
            with httpx.Client(timeout=5.0) as client:
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
                    
                    if resp.status_code in (401, 403):
                        logger.warning("Google Maps API key returned status %d. Disabling Google Maps API for 10 minutes.", resp.status_code)
                        TrafficService._google_disabled_until = time.time() + 600
                        return None
                        
                    resp.raise_for_status()
                    data = resp.json()
                    
                    if data.get("status") == "REQUEST_DENIED":
                        logger.warning("Google Maps API returned REQUEST_DENIED. Disabling Google Maps API for 10 minutes.")
                        TrafficService._google_disabled_until = time.time() + 600
                        return None
                        
                    if data.get("status") != "OK" or not data.get("routes"):
                        continue
                    leg = data["routes"][0]["legs"][0]
                    duration = leg.get("duration_in_traffic", leg.get("duration", {}))
                    distance = leg.get("distance", {}).get("value", 1000)
                    seconds = duration.get("value", 60)
                    speed_kmh = (distance / 1000) / (seconds / 3600) if seconds > 0 else meta["baseline_speed_kmh"]
                    speeds[zone] = round(min(speed_kmh, meta["baseline_speed_kmh"]), 2)
            if speeds:
                TrafficService._last_source = "google_maps"
                return speeds
        except Exception as exc:
            logger.warning("Google Maps traffic fetch failed: %s", exc)
        return None

    def _fetch_tomtom_speeds(self) -> dict[str, float] | None:
        key = self._settings.tomtom_api_key
        speeds = {}
        try:
            with httpx.Client(timeout=5.0) as client:
                for zone, meta in BENGALURU_ZONES.items():
                    lat, lon = meta["center"]
                    url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
                    resp = client.get(url, params={"key": key, "point": f"{lat},{lon}"})
                    
                    if resp.status_code in (401, 403):
                        logger.warning("TomTom API key returned status %d. Disabling TomTom API for 10 minutes.", resp.status_code)
                        TrafficService._tomtom_disabled_until = time.time() + 600
                        return None
                        
                    resp.raise_for_status()
                    data = resp.json()
                    flow = data.get("flowSegmentData", {})
                    speed = flow.get("currentSpeed")
                    if speed is not None:
                        speeds[zone] = round(float(speed), 2)
            if speeds:
                TrafficService._last_source = "tomtom"
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
