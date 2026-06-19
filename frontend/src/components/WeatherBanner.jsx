import { useEffect, useState } from 'react';
import { api } from '../api/client';

const WEATHER_ICONS = {
  Thunderstorm: '⛈️',
  Drizzle: '🌦️',
  Rain: '🌧️',
  Snow: '❄️',
  Mist: '🌫️',
  Haze: '🌫️',
  Fog: '🌫️',
  Smoke: '🌫️',
  Dust: '🌪️',
  Clear: '☀️',
  Clouds: '⛅',
};

const ALERT_STYLES = {
  CRITICAL: {
    border: 'border-command-danger/50',
    bg: 'bg-gradient-to-r from-command-danger/15 via-command-danger/10 to-transparent',
    badge: 'bg-command-danger/20 text-command-danger',
    text: 'text-command-danger',
    pulse: true,
  },
  HIGH: {
    border: 'border-orange-500/50',
    bg: 'bg-gradient-to-r from-orange-500/15 via-orange-500/10 to-transparent',
    badge: 'bg-orange-500/20 text-orange-400',
    text: 'text-orange-400',
    pulse: true,
  },
  MEDIUM: {
    border: 'border-command-warning/50',
    bg: 'bg-gradient-to-r from-command-warning/15 via-command-warning/10 to-transparent',
    badge: 'bg-command-warning/20 text-command-warning',
    text: 'text-command-warning',
    pulse: false,
  },
  LOW: {
    border: 'border-command-accent/30',
    bg: 'bg-gradient-to-r from-command-accent/10 via-transparent to-transparent',
    badge: 'bg-command-accent/20 text-command-accent',
    text: 'text-command-accent',
    pulse: false,
  },
  NONE: {
    border: 'border-command-success/30',
    bg: 'bg-gradient-to-r from-command-success/8 via-transparent to-transparent',
    badge: 'bg-command-success/20 text-command-success',
    text: 'text-command-success',
    pulse: false,
  },
};

export default function WeatherBanner({ weatherData, liveWeather }) {
  const [weather, setWeather] = useState(weatherData || liveWeather || null);
  const [loading, setLoading] = useState(!weatherData && !liveWeather);

  // Fetch weather on mount if not provided
  useEffect(() => {
    if (weather) return;
    api
      .getWeather()
      .then((res) => setWeather(res.data))
      .catch(() => setWeather(null))
      .finally(() => setLoading(false));
  }, []);

  // Update from live tick
  useEffect(() => {
    if (liveWeather) {
      setWeather(liveWeather);
      setLoading(false);
    }
  }, [liveWeather]);

  if (loading || !weather) return null;

  const icon = WEATHER_ICONS[weather.condition] || '🌤️';
  const alertLevel = weather.alert_level || 'NONE';
  const style = ALERT_STYLES[alertLevel] || ALERT_STYLES.NONE;
  const isEscalated = weather.multiplier > 1.0;
  return (
    <div
      id="weather-banner"
      className={`weather-banner-card weather-card-${alertLevel.toLowerCase()} relative overflow-hidden rounded-xl border px-4 py-3.5 transition-all duration-500 backdrop-blur-md`}
    >
      {/* Pulse animation for rain alerts */}
      {style.pulse && (
        <div className="absolute inset-0 animate-pulse opacity-30"
          style={{
            background: alertLevel === 'CRITICAL'
              ? 'radial-gradient(ellipse at left, rgba(239,68,68,0.2), transparent 70%)'
              : 'radial-gradient(ellipse at left, rgba(249,115,22,0.2), transparent 70%)',
          }}
        />
      )}

      <div className="relative flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Weather icon + condition */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="weather-title text-sm font-bold">
              {weather.condition}
              <span className="weather-meta ml-2 text-xs font-normal">
                {weather.temperature_c}°C · {weather.humidity_pct}% humidity
              </span>
            </p>
            <p className="weather-desc text-xs capitalize">{weather.description}</p>
          </div>
        </div>

        {/* Escalation badge */}
        {isEscalated ? (
          <div className="weather-badge rounded-lg px-3 py-1.5 text-xs font-bold">
            ⚠ Risk {weather.multiplier}x · Severity +{weather.severity_boost}
          </div>
        ) : (
          <div className="weather-badge rounded-lg px-3 py-1.5 text-xs font-medium">
            ✓ Normal risk levels
          </div>
        )}

        {/* Rain detail */}
        {weather.rain_mm_1h > 0 && (
          <span className="weather-rain-info text-xs font-semibold">
            🌧 {weather.rain_mm_1h} mm/h
          </span>
        )}

        {/* Escalation description */}
        {isEscalated && (
          <p className="weather-escalation-desc w-full text-xs sm:w-auto sm:ml-auto">
            <span className="weather-alert-label font-bold mr-1">Rain Alert</span> — Predictions &
            severity scores auto-escalated for monsoon conditions
          </p>
        )}
      </div>
    </div>
  );
}
