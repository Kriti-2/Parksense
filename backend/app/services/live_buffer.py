import logging
import threading
from collections import deque
from datetime import datetime, timezone
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)


class LiveViolationBuffer:
    """In-memory buffer for ingested and replayed live violations."""

    _instance: "LiveViolationBuffer | None" = None
    MAX_SIZE = 1000

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._rows: deque[dict] = deque(maxlen=cls.MAX_SIZE)
            cls._instance._lock = threading.Lock()
            cls._instance._replay_cursor = 0
            cls._instance._replay_pool: list[dict] = []
        return cls._instance

    def configure_replay_pool(self, df: pd.DataFrame, pool_size: int = 3000) -> None:
        if df.empty:
            self._replay_pool = []
            return
        sample = df.sort_values("created_datetime", ascending=False).head(pool_size)
        self._replay_pool = sample.to_dict(orient="records")
        self._replay_cursor = 0
        logger.info("Live replay pool configured with %d violations", len(self._replay_pool))

    def ingest(self, violation: dict) -> dict:
        row = {**violation, "source": "ingest", "ingested_at": datetime.now(timezone.utc).isoformat()}
        if "created_datetime" not in row or not row["created_datetime"]:
            row["created_datetime"] = datetime.now(timezone.utc)
        with self._lock:
            self._rows.append(row)
        return row

    def replay_tick(self, count: int = 2) -> list[dict]:
        """Emit violations from the replay pool with current timestamps."""
        if not self._replay_pool:
            return []

        emitted = []
        with self._lock:
            for _ in range(count):
                if not self._replay_pool:
                    break
                raw = self._replay_pool[self._replay_cursor % len(self._replay_pool)]
                self._replay_cursor += 1
                row = {
                    **raw,
                    "id": f"LIVE-{self._replay_cursor}-{raw.get('id', '')}",
                    "created_datetime": datetime.now(timezone.utc),
                    "source": "replay",
                }
                self._rows.append(row)
                emitted.append(row)
        return emitted

    def to_dataframe(self) -> pd.DataFrame:
        with self._lock:
            if not self._rows:
                return pd.DataFrame()
            return pd.DataFrame(list(self._rows))

    def recent_dataframe(self, hours: int = 24) -> pd.DataFrame:
        df = self.to_dataframe()
        if df.empty:
            return df
        if "created_datetime" in df.columns:
            df["created_datetime"] = pd.to_datetime(df["created_datetime"], utc=True, errors="coerce")
            cutoff = pd.Timestamp.utcnow().tz_localize("UTC") - pd.Timedelta(hours=hours)
            df = df[df["created_datetime"] >= cutoff]
        return df

    def stats(self) -> dict[str, Any]:
        with self._lock:
            ingest_count = sum(1 for r in self._rows if r.get("source") == "ingest")
            replay_count = sum(1 for r in self._rows if r.get("source") == "replay")
            return {
                "buffer_size": len(self._rows),
                "ingested": ingest_count,
                "replayed": replay_count,
                "replay_pool_size": len(self._replay_pool),
            }


def get_live_buffer() -> LiveViolationBuffer:
    return LiveViolationBuffer()
