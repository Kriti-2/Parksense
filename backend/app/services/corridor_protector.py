from datetime import datetime

import pandas as pd

from app.models.responses import CorridorStatus
from app.utilities.constants import EMERGENCY_CORRIDORS


class GreenCorridorProtector:
    """Monitor predefined emergency corridors for parking violations."""

    def evaluate(self, violations_df: pd.DataFrame) -> list[CorridorStatus]:
        now = datetime.utcnow().isoformat()
        results: list[CorridorStatus] = []

        recent = pd.DataFrame()
        if not violations_df.empty and "created_datetime" in violations_df.columns:
            recent = violations_df.copy()
            recent["created_datetime"] = pd.to_datetime(
                recent["created_datetime"], utc=True, errors="coerce"
            )
            cutoff = pd.Timestamp.utcnow() - pd.Timedelta(hours=24)
            recent = recent[recent["created_datetime"] >= cutoff]

        for corridor in EMERGENCY_CORRIDORS:
            corridor_zones = set(corridor["zones"])
            if not recent.empty:
                active = recent[recent["zone"].isin(corridor_zones)]
                active_count = len(active)
            else:
                active_count = self._mock_active_count(corridor["id"])

            status = self._derive_status(active_count, corridor["priority"])
            results.append(
                CorridorStatus(
                    id=corridor["id"],
                    name=corridor["name"],
                    status=status,
                    active_violations=active_count,
                    priority_level=corridor["priority"],
                    zones=corridor["zones"],
                    last_checked=now,
                )
            )

        return results

    def _derive_status(self, active_violations: int, priority: str) -> str:
        if priority == "CRITICAL" and active_violations >= 3:
            return "BLOCKED"
        if active_violations >= 5:
            return "BLOCKED"
        if active_violations >= 2:
            return "DEGRADED"
        if active_violations >= 1:
            return "CAUTION"
        return "CLEAR"

    def _mock_active_count(self, corridor_id: str) -> int:
        mock = {"EC-001": 4, "EC-002": 2, "EC-003": 1, "EC-004": 0}
        return mock.get(corridor_id, 0)
