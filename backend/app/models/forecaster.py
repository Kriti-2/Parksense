from datetime import datetime, timedelta
import logging

import numpy as np
import pandas as pd

from app.models.forecast_schemas import ForecastResponse, PredictionZone
from app.utilities.constants import BENGALURU_ZONES

logger = logging.getLogger(__name__)


class ParkPredictForecaster:
    """Prophet-based violation hotspot forecasting for next 24 hours."""

    def __init__(self):
        self._prophet_enabled = False
        try:
            from prophet import Prophet

            model = Prophet()
            if hasattr(model, "fit"):
                self._prophet_enabled = True
        except Exception as exc:
            logger.warning("Prophet unavailable: %s", exc)

    def _prepare_training_data(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return pd.DataFrame(columns=["ds", "y", "zone"])

        working = df.copy()
        working["created_datetime"] = pd.to_datetime(working["created_datetime"], utc=True, errors="coerce")
        working = working.dropna(subset=["created_datetime", "zone"])

        hourly = (
            working.groupby(["zone", pd.Grouper(key="created_datetime", freq="h")])
            .size()
            .reset_index(name="y")
        )
        hourly = hourly.rename(columns={"created_datetime": "ds"})
        return hourly

    def _prophet_forecast_zone(self, zone_df: pd.DataFrame, zone_name: str) -> dict:
        from prophet import Prophet

        if len(zone_df) < 24:
            avg = zone_df["y"].mean() if not zone_df.empty else 5
            return {"zone": zone_name, "predicted": int(max(avg * 24, 3)), "confidence": 0.55}

        model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=False,
            changepoint_prior_scale=0.05,
        )
        model.fit(zone_df[["ds", "y"]])

        future = model.make_future_dataframe(periods=24, freq="h")
        forecast = model.predict(future).tail(24)
        predicted = int(max(forecast["yhat"].sum(), 1))
        confidence = float(np.clip(1 - forecast["yhat_std"].mean() / (forecast["yhat"].mean() + 1), 0.4, 0.95))

        peak_idx = forecast["yhat"].idxmax()
        peak_hour = pd.to_datetime(forecast.loc[peak_idx, "ds"]).hour

        return {
            "zone": zone_name,
            "predicted": predicted,
            "confidence": round(confidence, 2),
            "peak_hour": peak_hour,
        }

    def _statistical_forecast(self, df: pd.DataFrame) -> list[dict]:
        if df.empty:
            return self._mock_forecast()

        working = df.copy()
        working["created_datetime"] = pd.to_datetime(working["created_datetime"], utc=True, errors="coerce")
        working["hour"] = working["created_datetime"].dt.hour
        working["dow"] = working["created_datetime"].dt.dayofweek

        now = datetime.utcnow()
        current_dow = now.weekday()
        current_hour = now.hour

        results = []
        for zone in BENGALURU_ZONES:
            zone_data = working[working["zone"] == zone]
            if zone_data.empty:
                predicted = np.random.randint(8, 25)
                confidence = 0.5
                peak_hour = 18
            else:
                same_slot = zone_data[
                    (zone_data["dow"] == current_dow) & (zone_data["hour"] >= current_hour)
                ]
                base_rate = len(same_slot) / max(len(zone_data["created_datetime"].dt.date.unique()), 1)
                predicted = int(max(base_rate * 3, len(zone_data) / 500))
                confidence = min(0.85, 0.5 + len(zone_data) / 10000)
                peak_hour = int(zone_data.groupby("hour").size().idxmax()) if len(zone_data) > 10 else 18

            results.append(
                {
                    "zone": zone,
                    "predicted": predicted,
                    "confidence": round(confidence, 2),
                    "peak_hour": peak_hour,
                }
            )
        return results

    def _mock_forecast(self) -> list[dict]:
        import random

        random.seed(42)
        mock_rates = {
            "Silk Board": (45, 0.88, 19),
            "MG Road": (38, 0.85, 18),
            "Koramangala": (32, 0.82, 17),
            "HSR Layout": (28, 0.80, 20),
            "Indiranagar": (25, 0.78, 18),
            "Whitefield": (22, 0.75, 9),
        }
        return [
            {
                "zone": zone,
                "predicted": mock_rates[zone][0] + random.randint(-3, 5),
                "confidence": mock_rates[zone][1],
                "peak_hour": mock_rates[zone][2],
            }
            for zone in BENGALURU_ZONES
        ]

    def forecast(self, violations_df: pd.DataFrame) -> ForecastResponse:
        hourly = self._prepare_training_data(violations_df)
        zone_forecasts: list[dict] = []

        if self._prophet_enabled and not hourly.empty:
            prophet_failed = False
            for zone in BENGALURU_ZONES:
                zone_hourly = hourly[hourly["zone"] == zone][["ds", "y"]]
                try:
                    zone_forecasts.append(self._prophet_forecast_zone(zone_hourly, zone))
                except Exception as exc:
                    logger.warning("Prophet failed for %s: %s", zone, exc)
                    prophet_failed = True
                    break
            if prophet_failed or not zone_forecasts:
                zone_forecasts = self._statistical_forecast(violations_df)
        else:
            zone_forecasts = (
                self._statistical_forecast(violations_df)
                if not violations_df.empty
                else self._mock_forecast()
            )

        zone_forecasts.sort(key=lambda x: x["predicted"], reverse=True)
        top_10 = zone_forecasts[:10]

        predictions: list[PredictionZone] = []
        max_pred = max(z["predicted"] for z in top_10) if top_10 else 1

        for rank, item in enumerate(top_10, start=1):
            meta = BENGALURU_ZONES[item["zone"]]
            risk_score = round((item["predicted"] / max_pred) * 100, 2)
            drivers = []
            if item["peak_hour"] in range(8, 11):
                drivers.append("Morning peak commute")
            if item["peak_hour"] in range(17, 21):
                drivers.append("Evening peak commute")
            if item["zone"] in ("Silk Board", "MG Road"):
                drivers.append("High commercial density")
            if not drivers:
                drivers.append("Historical violation pattern")

            predictions.append(
                PredictionZone(
                    rank=rank,
                    zone=item["zone"],
                    risk_score=risk_score,
                    predicted_violations=item["predicted"],
                    peak_hour=item["peak_hour"],
                    confidence=item["confidence"],
                    latitude=meta["center"][0],
                    longitude=meta["center"][1],
                    drivers=drivers,
                )
            )

        return ForecastResponse(
            generated_at=datetime.utcnow(),
            horizon_hours=24,
            top_risk_zones=predictions,
        )
