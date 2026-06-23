import logging
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from app.models.forecast_schemas import ShortTermForecastResponse, ShortTermPredictionZone
from app.utilities.constants import BENGALURU_ZONES

logger = logging.getLogger(__name__)


def round_half_up(val: float) -> int:
    return int(np.floor(val + 0.5))



class ShortTermParkPredictForecaster:
    """Random Forest based sub-hourly violation forecasting."""

    def __init__(self):
        self.model_15m = RandomForestRegressor(n_estimators=50, max_depth=8, random_state=42)
        self.model_30m = RandomForestRegressor(n_estimators=50, max_depth=8, random_state=42)
        self.is_trained = False
        self.fallback_averages = {}  # {(zone, hour): mean_count}

    def train(self, df: pd.DataFrame) -> None:
        """Process lag/rolling features and train the Random Forest models."""
        try:
            if df.empty or len(df) < 100:
                logger.warning("Dataset is too small to train short-term ML model. Using fallback averages.")
                self._compute_fallback_averages(df)
                return

            # Prepare time-series grid
            working = df.copy()
            working["created_datetime"] = pd.to_datetime(working["created_datetime"], utc=True, errors="coerce")
            working = working.dropna(subset=["created_datetime", "zone"])

            if working.empty:
                self._compute_fallback_averages(df)
                return

            max_ts = working["created_datetime"].max()
            if pd.notna(max_ts):
                cutoff_time = max_ts - pd.Timedelta(days=14)
                working = working[working["created_datetime"] >= cutoff_time]

            if working.empty or len(working) < 100:
                logger.warning("Insufficient data points in the last 14 days. Using fallback averages.")
                self._compute_fallback_averages(df)
                return

            # Determine dataset time range
            min_time = working["created_datetime"].min().floor("15min")
            max_time = working["created_datetime"].max().ceil("15min")

            # Create the 15-minute grid range
            all_times = pd.date_range(start=min_time, end=max_time, freq="15min", tz="UTC")

            # We want to build a dense dataset for each zone
            zone_dfs = []
            for zone in BENGALURU_ZONES:
                zone_data = working[working["zone"] == zone]
                # Group by 15-minute intervals
                grouped = zone_data.groupby(pd.Grouper(key="created_datetime", freq="15min")).size()
                # Reindex to get the complete time grid, fill missing with 0
                grouped = grouped.reindex(all_times, fill_value=0)

                zone_df = pd.DataFrame(index=all_times)
                zone_df["count"] = grouped.values
                zone_df["zone"] = zone

                # Feature engineering using shifts
                zone_df["lag_1"] = zone_df["count"].shift(1)
                zone_df["lag_2"] = zone_df["count"].shift(2)
                zone_df["lag_3"] = zone_df["count"].shift(3)
                zone_df["rolling_mean_1h"] = zone_df["count"].shift(1).rolling(4).mean()

                # Targets
                zone_df["target_15m"] = zone_df["count"]
                zone_df["target_30m"] = zone_df["count"] + zone_df["count"].shift(-1)

                zone_dfs.append(zone_df)

            combined = pd.concat(zone_dfs).dropna()

            if len(combined) < 100:
                logger.warning("Insufficient data points after lagging. Using fallback averages.")
                self._compute_fallback_averages(df)
                return

            # Extract time features
            combined["hour"] = combined.index.hour
            combined["minute"] = combined.index.minute
            combined["dayofweek"] = combined.index.dayofweek

            # Encode zone category (one-hot)
            # Use columns matching all BENGALURU_ZONES keys so the model always receives a consistent feature shape
            for zone in BENGALURU_ZONES:
                combined[f"zone_{zone}"] = (combined["zone"] == zone).astype(float)

            feature_cols = [
                "lag_1", "lag_2", "lag_3", "rolling_mean_1h",
                "hour", "minute", "dayofweek"
            ] + [f"zone_{zone}" for zone in BENGALURU_ZONES]

            X = combined[feature_cols]
            y_15 = combined["target_15m"]
            y_30 = combined["target_30m"]

            self.model_15m.fit(X, y_15)
            self.model_30m.fit(X, y_30)
            self.is_trained = True

            # Save fallback averages as well in case of prediction failure or new zones
            self._compute_fallback_averages(df)
            logger.info("Short-term forecasting ML model trained successfully.")

        except Exception as e:
            logger.error("Error training short-term forecasting model: %s. Falling back.", e)
            self._compute_fallback_averages(df)

    def _compute_fallback_averages(self, df: pd.DataFrame) -> None:
        """Compute fallback hourly averages from historical data."""
        self.fallback_averages = {}
        # default fallback value
        default_val = 0.5

        # Initialize with baseline defaults
        for zone in BENGALURU_ZONES:
            for hour in range(24):
                self.fallback_averages[(zone, hour)] = default_val

        if df.empty:
            return

        try:
            working = df.copy()
            working["created_datetime"] = pd.to_datetime(working["created_datetime"], utc=True, errors="coerce")
            working = working.dropna(subset=["created_datetime", "zone"])
            if working.empty:
                return

            working["hour"] = working["created_datetime"].dt.hour
            # Group by zone, date, and hour to get historical counts per hour
            working["date"] = working["created_datetime"].dt.date

            hourly_counts = working.groupby(["zone", "date", "hour"]).size().reset_index(name="count")
            avg_hourly = hourly_counts.groupby(["zone", "hour"])["count"].mean().to_dict()

            for (zone, hour), avg_val in avg_hourly.items():
                # Store average 15-minute slot value (avg hourly rate / 4)
                self.fallback_averages[(zone, hour)] = max(avg_val / 4.0, 0.1)
        except Exception as e:
            logger.error("Error computing fallback averages: %s", e)

    def predict(self, violations_df: pd.DataFrame, reference_time: datetime) -> ShortTermForecastResponse:
        """Generate short term predictions for each zone at reference_time."""
        predictions = []
        if hasattr(reference_time, "tzinfo") and reference_time.tzinfo is not None:
            ref_tz = pd.Timestamp(reference_time).tz_convert("UTC")
        else:
            ref_tz = pd.Timestamp(reference_time).tz_localize("UTC")

        # Calculate lag features from recent data relative to reference_time
        working = violations_df.copy()
        if not working.empty:
            working["created_datetime"] = pd.to_datetime(working["created_datetime"], utc=True, errors="coerce")
            working = working.dropna(subset=["created_datetime", "zone"])

        if not working.empty:
            t_60 = ref_tz - timedelta(minutes=60)
            recent_violations = working[(working["created_datetime"] > t_60) & (working["created_datetime"] <= ref_tz)]
        else:
            recent_violations = pd.DataFrame()

        counts_15 = {}
        counts_30 = {}
        counts_45 = {}
        counts_60 = {}

        if not recent_violations.empty:
            t_15 = ref_tz - timedelta(minutes=15)
            t_30 = ref_tz - timedelta(minutes=30)
            t_45 = ref_tz - timedelta(minutes=45)

            mask_15 = recent_violations["created_datetime"] > t_15
            mask_30 = (recent_violations["created_datetime"] > t_30) & (recent_violations["created_datetime"] <= t_15)
            mask_45 = (recent_violations["created_datetime"] > t_45) & (recent_violations["created_datetime"] <= t_30)
            mask_60 = recent_violations["created_datetime"] <= t_45

            counts_15 = recent_violations[mask_15].groupby("zone").size().to_dict()
            counts_30 = recent_violations[mask_30].groupby("zone").size().to_dict()
            counts_45 = recent_violations[mask_45].groupby("zone").size().to_dict()
            counts_60 = recent_violations[mask_60].groupby("zone").size().to_dict()

        features_list = []
        hour = ref_tz.hour
        minute = ref_tz.minute
        dayofweek = ref_tz.dayofweek

        for zone in BENGALURU_ZONES:
            c_15 = counts_15.get(zone, 0)
            c_30 = counts_30.get(zone, 0)
            c_45 = counts_45.get(zone, 0)
            c_60 = counts_60.get(zone, 0)

            rolling_mean_1h = (c_15 + c_30 + c_45 + c_60) / 4.0

            features = {
                "lag_1": c_15,
                "lag_2": c_30,
                "lag_3": c_45,
                "rolling_mean_1h": rolling_mean_1h,
                "hour": hour,
                "minute": minute,
                "dayofweek": dayofweek,
                "current_violations": c_15
            }
            for z in BENGALURU_ZONES:
                features[f"zone_{z}"] = 1.0 if z == zone else 0.0
            features_list.append(features)

        X_pred_all = pd.DataFrame(features_list)
        feature_cols = [
            "lag_1", "lag_2", "lag_3", "rolling_mean_1h",
            "hour", "minute", "dayofweek"
        ] + [f"zone_{z}" for z in BENGALURU_ZONES]
        X_pred = X_pred_all[feature_cols]

        use_ml = False
        if self.is_trained:
            try:
                preds_15_batch = self.model_15m.predict(X_pred)
                preds_30_batch = self.model_30m.predict(X_pred)

                # estimators_preds shape: (50, 6)
                estimators_preds = np.array([tree.predict(X_pred.values) for tree in self.model_15m.estimators_])
                std_devs = np.std(estimators_preds, axis=0)
                mean_preds = np.mean(estimators_preds, axis=0)
                confidences = 1.0 - std_devs / (mean_preds + 1.0)
                confidences = np.clip(confidences, 0.4, 0.95)
                use_ml = True
            except Exception as e:
                logger.warning("ML batch prediction failed: %s. Using fallback.", e)

        for i, zone in enumerate(BENGALURU_ZONES):
            meta = BENGALURU_ZONES[zone]
            current_violations = int(X_pred_all.loc[i, "current_violations"])

            if use_ml:
                pred_15 = max(0, round_half_up(preds_15_batch[i]))
                pred_30 = max(0, round_half_up(preds_30_batch[i]))
                confidence = float(confidences[i])
            else:
                pred_15, pred_30, confidence = self._get_fallback_prediction(zone, ref_tz)

            predictions.append(
                ShortTermPredictionZone(
                    zone=zone,
                    current_violations=current_violations,
                    predicted_15m=pred_15,
                    predicted_30m=pred_30,
                    confidence=round(confidence, 2),
                    latitude=meta["center"][0],
                    longitude=meta["center"][1]
                )
            )

        return ShortTermForecastResponse(
            generated_at=reference_time,
            interval_minutes=15,
            predictions=predictions
        )

    def _get_fallback_prediction(self, zone: str, ref_tz: pd.Timestamp) -> tuple[int, int, float]:
        hour = ref_tz.hour
        val_15 = self.fallback_averages.get((zone, hour), 0.5)
        # Next 30m is the current 15m + next 15m. Next 15m is either same hour or next hour
        next_hour = (hour + 1) % 24 if ref_tz.minute >= 45 else hour
        val_30_second_half = self.fallback_averages.get((zone, next_hour), 0.5)

        pred_15 = max(0, round_half_up(val_15))
        pred_30 = max(0, round_half_up(val_15 + val_30_second_half))
        confidence = 0.5
        return pred_15, pred_30, confidence
