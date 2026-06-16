import math
from typing import Sequence


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between two lat/lon points in kilometres."""
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return radius_km * 2 * math.asin(math.sqrt(a))


def point_in_bbox(lat: float, lon: float, bbox: Sequence[float]) -> bool:
    """Check if a point falls within [min_lat, min_lon, max_lat, max_lon]."""
    min_lat, min_lon, max_lat, max_lon = bbox
    return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon


def assign_zone(lat: float, lon: float, zones: dict) -> str:
    """Assign the nearest Bengaluru zone to a coordinate."""
    for name, meta in zones.items():
        if point_in_bbox(lat, lon, meta["bbox"]):
            return name

    nearest = min(
        zones.keys(),
        key=lambda z: haversine_km(lat, lon, zones[z]["center"][0], zones[z]["center"][1]),
    )
    return nearest
