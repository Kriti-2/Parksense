"""
Weather service for Bengaluru — fetches current conditions from OpenWeatherMap
and provides escalation multipliers for rain/monsoon scenarios.

Caches weather data for 10 minutes to stay within free-tier rate limits.
Gracefully degrades to neutral multipliers if API key is missing or API fails.
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Bengaluru coordinates
BENGALURU_LAT = 12.9716
BENGALURU_LON = 77.5946

# Weather condition ID ranges → escalation mapping
# See: https://openweathermap.org/weather-conditions
WEATHER_ESCALATION_MAP = {
    # Thunderstorm (2xx)
    "thunderstorm": {"multiplier": 1.7, "severity_boost": 25, "alert_level": "CRITICAL"},
    # Drizzle (3xx)
    "drizzle": {"multiplier": 1.2, "severity_boost": 8, "alert_level": "LOW"},
    # Heavy rain (5xx, id >= 502)
    "heavy_rain": {"multiplier": 1.5, "severity_boost": 18, "alert_level": "HIGH"},
    # Light/moderate rain (5xx, id < 502)
    "rain": {"multiplier": 1.3, "severity_boost": 10, "alert_level": "MEDIUM"},
    # Fog / Mist / Haze (7xx)
    "atmosphere": {"multiplier": 1.15, "severity_boost": 5, "alert_level": "LOW"},
    # Clear / Clouds (8xx)
    "clear": {"multiplier": 1.0, "severity_boost": 0, "alert_level": "NONE"},
}


@dataclass
class WeatherData:
    """Structured weather response with escalation factors."""

    condition: str = "Clear"
    description: str = "clear sky"
    icon: str = "01d"
    temperature_c: float = 28.0
    humidity_pct: int = 60
    wind_speed_kmh: float = 10.0
    weather_id: int = 800
    rain_mm_1h: float = 0.0
    multiplier: float = 1.0
    severity_boost: float = 0.0
    alert_level: str = "NONE"
    fetched_at: str = ""
    source: str = "openweathermap"
    is_rain: bool = False

    def to_dict(self) -> dict:
        return {
            "condition": self.condition,
            "description": self.description,
            "icon": self.icon,
            "icon_url": f"https://openweathermap.org/img/wn/{self.icon}@2x.png",
            "temperature_c": self.temperature_c,
            "humidity_pct": self.humidity_pct,
            "wind_speed_kmh": self.wind_speed_kmh,
            "weather_id": self.weather_id,
            "rain_mm_1h": self.rain_mm_1h,
            "multiplier": self.multiplier,
            "severity_boost": self.severity_boost,
            "alert_level": self.alert_level,
            "is_rain": self.is_rain,
            "fetched_at": self.fetched_at,
            "source": self.source,
        }


def _classify_weather(weather_id: int, rain_mm: float = 0.0) -> dict:
    """Map OpenWeatherMap condition ID to escalation parameters."""
    if 200 <= weather_id < 300:
        return WEATHER_ESCALATION_MAP["thunderstorm"]
    elif 300 <= weather_id < 400:
        return WEATHER_ESCALATION_MAP["drizzle"]
    elif 500 <= weather_id < 600:
        if weather_id >= 502 or rain_mm >= 7.5:
            return WEATHER_ESCALATION_MAP["heavy_rain"]
        return WEATHER_ESCALATION_MAP["rain"]
    elif 600 <= weather_id < 700:
        # Snow (unlikely in Bengaluru, but handle it)
        return WEATHER_ESCALATION_MAP["rain"]
    elif 700 <= weather_id < 800:
        return WEATHER_ESCALATION_MAP["atmosphere"]
    else:
        return WEATHER_ESCALATION_MAP["clear"]


class WeatherService:
    """Fetch and cache Bengaluru weather from OpenWeatherMap."""

    _instance: "WeatherService | None" = None
    _cache: WeatherData | None = None
    _cache_timestamp: float = 0
    _cache_ttl: float = 600  # 10 minutes

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _is_cache_valid(self) -> bool:
        return self._cache is not None and (time.time() - self._cache_timestamp) < self._cache_ttl

    def get_weather(self) -> WeatherData:
        """Return current Bengaluru weather (cached for 10 min)."""
        if self._is_cache_valid():
            return self._cache

        settings = get_settings()
        if not settings.weather_api_key:
            logger.debug("No WEATHER_API_KEY — returning neutral weather")
            return self._neutral_weather()

        try:
            data = self._fetch_from_api(settings.weather_api_key)
            self._cache = data
            self._cache_timestamp = time.time()
            logger.info(
                "Weather updated: %s (%s) — multiplier %.2fx, severity +%.0f",
                data.condition,
                data.description,
                data.multiplier,
                data.severity_boost,
            )
            return data
        except Exception as exc:
            logger.warning("Weather API fetch failed: %s — caching neutral fallback for %ds", exc, self._cache_ttl)
            self._cache = self._neutral_weather()
            self._cache_timestamp = time.time()
            return self._cache

    def get_escalation(self) -> tuple[float, float]:
        """Return (multiplier, severity_boost) for current weather."""
        weather = self.get_weather()
        return weather.multiplier, weather.severity_boost

    def _fetch_from_api(self, api_key: str) -> WeatherData:
        """Call OpenWeatherMap Current Weather API."""
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {
            "lat": BENGALURU_LAT,
            "lon": BENGALURU_LON,
            "appid": api_key,
            "units": "metric",
        }

        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        weather_block = data.get("weather", [{}])[0]
        weather_id = weather_block.get("id", 800)
        main_block = data.get("main", {})
        wind_block = data.get("wind", {})
        rain_block = data.get("rain", {})

        rain_mm = rain_block.get("1h", 0.0)
        escalation = _classify_weather(weather_id, rain_mm)

        is_rain = weather_id < 700 and weather_id >= 200

        return WeatherData(
            condition=weather_block.get("main", "Clear"),
            description=weather_block.get("description", "clear sky"),
            icon=weather_block.get("icon", "01d"),
            temperature_c=round(main_block.get("temp", 28.0), 1),
            humidity_pct=int(main_block.get("humidity", 60)),
            wind_speed_kmh=round(wind_block.get("speed", 0) * 3.6, 1),  # m/s → km/h
            weather_id=weather_id,
            rain_mm_1h=round(rain_mm, 2),
            multiplier=escalation["multiplier"],
            severity_boost=escalation["severity_boost"],
            alert_level=escalation["alert_level"],
            fetched_at=datetime.now(timezone.utc).isoformat(),
            source="openweathermap",
            is_rain=is_rain,
        )

    @staticmethod
    def _neutral_weather() -> WeatherData:
        """Fallback when no API key or API fails — no escalation applied."""
        return WeatherData(
            fetched_at=datetime.now(timezone.utc).isoformat(),
            source="fallback",
        )


def get_weather_service() -> WeatherService:
    return WeatherService()
