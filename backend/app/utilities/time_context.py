"""Time window helpers for live Bengaluru data."""

from datetime import datetime

import pandas as pd


def get_reference_time(df: pd.DataFrame, use_wall_clock: bool = False) -> pd.Timestamp:
    """
    Reference 'now' for filtering violations.
    Uses latest timestamp in the dataset unless wall_clock mode is enabled.
    """
    if use_wall_clock or df.empty or "created_datetime" not in df.columns:
        return pd.Timestamp.utcnow().tz_localize("UTC")

    latest = df["created_datetime"].max()
    if pd.isna(latest):
        return pd.Timestamp.utcnow().tz_localize("UTC")
    if latest.tzinfo is None:
        return latest.tz_localize("UTC")
    return latest


def filter_recent(df: pd.DataFrame, hours: int = 24, reference: pd.Timestamp | None = None) -> pd.DataFrame:
    """Return violations within the last N hours relative to reference time."""
    if df.empty or "created_datetime" not in df.columns:
        return df.iloc[0:0].copy()

    ref = reference or get_reference_time(df)
    cutoff = ref - pd.Timedelta(hours=hours)
    working = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(working["created_datetime"]):
        working["created_datetime"] = pd.to_datetime(working["created_datetime"], utc=True, errors="coerce")
    return working[(working["created_datetime"] >= cutoff) & (working["created_datetime"] <= ref)]


def violations_last_hour_count(df: pd.DataFrame, reference: pd.Timestamp | None = None) -> int:
    return len(filter_recent(df, hours=1, reference=reference))
