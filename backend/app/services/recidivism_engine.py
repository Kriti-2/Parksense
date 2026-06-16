import pandas as pd

from app.models.responses import RecidivismZone
from app.utilities.constants import BENGALURU_ZONES


class RecidivismHeatmapEngine:
    """Detect repeat offender zones with >60% recurrence flagged as STUBBORN ZONE."""

    STUBBORN_THRESHOLD = 0.60

    def analyze(self, violations_df: pd.DataFrame) -> list[RecidivismZone]:
        if violations_df.empty:
            return self._mock_recidivism()

        working = violations_df.copy()
        vehicle_col = "updated_vehicle_number"
        if vehicle_col not in working.columns or working[vehicle_col].isna().all():
            vehicle_col = "vehicle_number"

        zone_stats = []
        for zone in BENGALURU_ZONES:
            zone_data = working[working["zone"] == zone]
            if zone_data.empty:
                continue

            vehicles = zone_data[vehicle_col].dropna()
            total = len(vehicles)
            if total == 0:
                continue

            repeat_offenders = int(vehicles.value_counts()[vehicles.value_counts() > 1].sum())
            unique_repeat = int((vehicles.value_counts() > 1).sum())
            recurrence_rate = round(repeat_offenders / total, 4)
            is_stubborn = recurrence_rate > self.STUBBORN_THRESHOLD

            zone_stats.append(
                RecidivismZone(
                    zone=zone,
                    recurrence_rate=recurrence_rate,
                    total_violations=total,
                    repeat_offenders=unique_repeat,
                    is_stubborn_zone=is_stubborn,
                    recommendation=self._recommendation(zone, recurrence_rate, is_stubborn),
                    latitude=BENGALURU_ZONES[zone]["center"][0],
                    longitude=BENGALURU_ZONES[zone]["center"][1],
                )
            )

        zone_stats.sort(key=lambda z: z.recurrence_rate, reverse=True)
        return zone_stats if zone_stats else self._mock_recidivism()

    def _recommendation(self, zone: str, rate: float, is_stubborn: bool) -> str:
        if is_stubborn:
            return (
                f"STUBBORN ZONE: Deploy tow-truck patrol in {zone}. "
                f"Recurrence {rate:.0%} — escalate fines and install CCTV."
            )
        if rate > 0.40:
            return f"Increase patrol frequency in {zone}. Consider no-parking signage refresh."
        return f"Standard enforcement rotation for {zone}. Monitor weekly trends."

    def _mock_recidivism(self) -> list[RecidivismZone]:
        mock_data = [
            ("Silk Board", 0.72, 1840, 312, True),
            ("MG Road", 0.65, 1520, 245, True),
            ("Koramangala", 0.58, 2100, 380, False),
            ("HSR Layout", 0.51, 1650, 290, False),
            ("Indiranagar", 0.47, 1380, 210, False),
            ("Whitefield", 0.39, 980, 145, False),
        ]
        return [
            RecidivismZone(
                zone=zone,
                recurrence_rate=rate,
                total_violations=total,
                repeat_offenders=repeats,
                is_stubborn_zone=stubborn,
                recommendation=self._recommendation(zone, rate, stubborn),
                latitude=BENGALURU_ZONES[zone]["center"][0],
                longitude=BENGALURU_ZONES[zone]["center"][1],
            )
            for zone, rate, total, repeats, stubborn in mock_data
        ]
