"""Bengaluru zone definitions and platform constants."""

BENGALURU_ZONES: dict[str, dict] = {
    "Koramangala": {
        "center": [12.9352, 77.6245],
        "bbox": [12.920, 77.610, 12.950, 77.640],
        "baseline_speed_kmh": 28.0,
        "lane_width_m": 7.5,
    },
    "HSR Layout": {
        "center": [12.9116, 77.6473],
        "bbox": [12.895, 77.630, 12.925, 77.665],
        "baseline_speed_kmh": 26.0,
        "lane_width_m": 7.0,
    },
    "Indiranagar": {
        "center": [12.9784, 77.6408],
        "bbox": [12.965, 77.625, 12.995, 77.655],
        "baseline_speed_kmh": 24.0,
        "lane_width_m": 6.5,
    },
    "MG Road": {
        "center": [12.9750, 77.6063],
        "bbox": [12.968, 77.595, 12.982, 77.615],
        "baseline_speed_kmh": 18.0,
        "lane_width_m": 6.0,
    },
    "Silk Board": {
        "center": [12.9177, 77.6225],
        "bbox": [12.908, 77.612, 12.928, 77.635],
        "baseline_speed_kmh": 14.0,
        "lane_width_m": 5.5,
    },
    "Whitefield": {
        "center": [12.9698, 77.7500],
        "bbox": [12.955, 77.730, 12.990, 77.770],
        "baseline_speed_kmh": 22.0,
        "lane_width_m": 7.0,
    },
    "Majestic": {
        "center": [12.9766, 77.5712],
        "bbox": [12.965, 77.555, 12.985, 77.585],
        "baseline_speed_kmh": 18.0,
        "lane_width_m": 6.5,
    },
    "Hebbal": {
        "center": [13.0358, 77.5978],
        "bbox": [13.020, 77.580, 13.050, 77.615],
        "baseline_speed_kmh": 26.0,
        "lane_width_m": 7.0,
    },
    "Electronic City": {
        "center": [12.8452, 77.6602],
        "bbox": [12.830, 77.640, 12.860, 77.680],
        "baseline_speed_kmh": 28.0,
        "lane_width_m": 7.5,
    },
    "Jayanagar": {
        "center": [12.9284, 77.5824],
        "bbox": [12.915, 77.570, 12.940, 77.595],
        "baseline_speed_kmh": 22.0,
        "lane_width_m": 6.0,
    },
    "Yelahanka": {
        "center": [13.0978, 77.5862],
        "bbox": [13.080, 77.570, 13.115, 77.605],
        "baseline_speed_kmh": 24.0,
        "lane_width_m": 6.5,
    },
    "Marathahalli": {
        "center": [12.9592, 77.6974],
        "bbox": [12.945, 77.680, 12.975, 77.715],
        "baseline_speed_kmh": 20.0,
        "lane_width_m": 7.0,
    },
    "Malleshwaram": {
        "center": [12.9984, 77.5720],
        "bbox": [12.985, 77.560, 13.010, 77.585],
        "baseline_speed_kmh": 20.0,
        "lane_width_m": 6.0,
    },
    "Banashankari": {
        "center": [12.9156, 77.5736],
        "bbox": [12.900, 77.560, 12.930, 77.590],
        "baseline_speed_kmh": 22.0,
        "lane_width_m": 6.5,
    },
    "BTM Layout": {
        "center": [12.9166, 77.6083],
        "bbox": [12.905, 77.595, 12.928, 77.620],
        "baseline_speed_kmh": 22.0,
        "lane_width_m": 6.0,
    },
    "Rajajinagar": {
        "center": [12.9892, 77.5562],
        "bbox": [12.975, 77.540, 13.000, 77.570],
        "baseline_speed_kmh": 20.0,
        "lane_width_m": 6.5,
    },
}

PEAK_HOURS: list[tuple[int, int]] = [
    (8, 11),
    (17, 21),
]

VEHICLE_SEVERITY_WEIGHTS: dict[str, float] = {
    "TANKER": 1.0,
    "TRUCK": 0.95,
    "BUS": 0.9,
    "MAXI-CAB": 0.85,
    "CAR": 0.7,
    "MOTOR CYCLE": 0.5,
    "SCOOTER": 0.45,
    "PASSENGER AUTO": 0.6,
}

EMERGENCY_CORRIDORS: list[dict] = [
    {
        "id": "EC-001",
        "name": "MG Road → Victoria Hospital",
        "zones": ["MG Road", "Indiranagar"],
        "priority": "CRITICAL",
        "waypoints": [[12.9750, 77.6063], [12.9650, 77.5980], [12.9560, 77.5920]],
    },
    {
        "id": "EC-002",
        "name": "Silk Board → Nimhans",
        "zones": ["Silk Board", "HSR Layout"],
        "priority": "HIGH",
        "waypoints": [[12.9177, 77.6225], [12.9380, 77.6100], [12.9385, 77.5970]],
    },
    {
        "id": "EC-003",
        "name": "Whitefield → Manipal Hospital",
        "zones": ["Whitefield"],
        "priority": "HIGH",
        "waypoints": [[12.9698, 77.7500], [12.9780, 77.7100], [12.9850, 77.6500]],
    },
    {
        "id": "EC-004",
        "name": "Koramangala → St. John's",
        "zones": ["Koramangala", "Indiranagar"],
        "priority": "MEDIUM",
        "waypoints": [[12.9352, 77.6245], [12.9550, 77.6350], [12.9700, 77.6380]],
    },
]
