from datetime import datetime

import pandas as pd

from app.models.responses import CorridorStatus
from app.utilities.constants import EMERGENCY_CORRIDORS


class GreenCorridorProtector:
    """Monitor predefined emergency corridors for parking violations."""

    def evaluate(self, violations_df: pd.DataFrame) -> list[CorridorStatus]:
        now = datetime.utcnow().isoformat()
        results: list[CorridorStatus] = []

        for corridor in EMERGENCY_CORRIDORS:
            corridor_zones = set(corridor["zones"])
            if not violations_df.empty and "zone" in violations_df.columns:
                active_count = len(violations_df[violations_df["zone"].isin(corridor_zones)])
            else:
                active_count = 0

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
