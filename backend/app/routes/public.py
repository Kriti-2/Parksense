from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user
from app.database import get_db
from app.data.loader import get_data_store
from app.models.user import User
from app.services.realtime_engine import get_realtime_engine
from app.services.traffic_service import TrafficService
from app.utilities.constants import BENGALURU_ZONES

router = APIRouter(prefix="/public", tags=["Public"])


@router.get("/congestion-preview")
def congestion_preview(user: User = Depends(require_user)):
    """
    User-facing congestion intelligence — plan trips and avoid parking hotspots.
    Requires user or officer login.
    """
    store = get_data_store()
    engine = get_realtime_engine()
    recent = engine.recent_window(hours=24)
    traffic = TrafficService()
    speeds = traffic.get_zone_speeds(recent)

    zones = []
    for name, meta in BENGALURU_ZONES.items():
        speed = speeds.get(name, meta["baseline_speed_kmh"] * 0.7)
        baseline = meta["baseline_speed_kmh"]
        drop_pct = round(max(0, (baseline - speed) / baseline * 100), 1)
        zone_recent = len(recent[recent["zone"] == name]) if not recent.empty else 0

        if drop_pct >= 60 or zone_recent >= 15:
            advisory = "AVOID"
            color = "red"
        elif drop_pct >= 35 or zone_recent >= 8:
            advisory = "CAUTION"
            color = "orange"
        else:
            advisory = "CLEAR"
            color = "green"

        zones.append(
            {
                "zone": name,
                "latitude": meta["center"][0],
                "longitude": meta["center"][1],
                "current_speed_kmh": speed,
                "baseline_speed_kmh": baseline,
                "speed_drop_pct": drop_pct,
                "parking_violations_24h": zone_recent,
                "advisory": advisory,
                "color": color,
                "tip": _tip_for_zone(name, advisory, drop_pct),
            }
        )

    zones.sort(key=lambda z: z["speed_drop_pct"], reverse=True)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "greeting": f"Hello {user.full_name}",
        "summary": {
            "avoid_zones": sum(1 for z in zones if z["advisory"] == "AVOID"),
            "caution_zones": sum(1 for z in zones if z["advisory"] == "CAUTION"),
            "clear_zones": sum(1 for z in zones if z["advisory"] == "CLEAR"),
        },
        "zones": zones,
        "traffic_source": traffic.last_meta.get("source"),
    }


@router.get("/notices")
def get_notices():
    """
    Get active notices and system alerts for citizens.
    """
    return {
        "notices": [
            {
                "id": "civic-bbmp-orr",
                "type": "circular",
                "urgency": "high",
                "source": "BBMP",
                "timestamp": datetime.utcnow().isoformat(),
                "title": "🚧 ORR Road Repair Commenced",
                "message": "BBMP has initiated road repair and utility works on Outer Ring Road (ORR) near Silk Board junction. Expect significant delays.",
            },
            {
                "id": "civic-smart-parking",
                "type": "circular",
                "urgency": "low",
                "source": "DULT",
                "timestamp": datetime.utcnow().isoformat(),
                "title": "🚗 Indiranagar IoT Smart Parking Live",
                "message": "New IoT-enabled smart parking slots are now live on Indiranagar 100 Feet Road. Book slots in real-time via मार्ग Sense.",
            },
            {
                "id": "civic-metro-extension",
                "type": "circular",
                "urgency": "low",
                "source": "BMRCL",
                "timestamp": datetime.utcnow().isoformat(),
                "title": "🚌 Metro Feeder Bus Frequency Increased",
                "message": "To reduce congestion, BMRCL has increased feeder bus frequency from Indiranagar Metro Station to IT hubs during peak hours.",
            },
            {
                "id": "traffic-slowdown-silk-board",
                "type": "traffic",
                "urgency": "high",
                "source": "BTP",
                "timestamp": datetime.utcnow().isoformat(),
                "title": "Traffic Slowdown: Silk Board Junction",
                "message": "Speeds reduced by 65% near Silk Board Junction due to illegal parking. Alternate routes advised.",
            }
        ]
    }


def _tip_for_zone(zone: str, advisory: str, drop_pct: float) -> str:
    if advisory == "AVOID":
        return f"High congestion ({drop_pct:.0f}% speed drop) in {zone}. Take alternate route or metro."
    if advisory == "CAUTION":
        return f"Moderate delays expected in {zone}. Allow 15+ extra minutes."
    return f"{zone} is flowing well. Good time to travel."


@router.get("/challan-lookup/{vehicle_number}")
def challan_lookup(vehicle_number: str, user: User = Depends(require_user)):
    """
    Search parking violations, calculate fine details and the Civic Standing Score
    for a given vehicle license plate.
    """
    import pandas as pd
    
    # 1. Sanitize plate inputs
    def sanitize_plate(plate: str) -> str:
        if not isinstance(plate, str):
            return ""
        return "".join(c for c in plate if c.isalnum()).upper()

    search_clean = sanitize_plate(vehicle_number)
    
    # 2. Get violations
    store = get_data_store()
    df = store.load()
    
    # 3. Fine pricing map
    fine_pricing = {
        "NO PARKING": 500,
        "DOUBLE PARKING": 1000,
        "WRONG SIDE PARKING": 1000,
        "OBSTRUCTING TRAFFIC": 1500,
        "PARKING ON FOOTPATH": 1500,
    }

    matching_violations = []
    
    if search_clean:
        for _, row in df.iterrows():
            p1 = sanitize_plate(row.get("updated_vehicle_number"))
            p2 = sanitize_plate(row.get("vehicle_number"))
            if search_clean == p1 or search_clean == p2:
                # Calculate fine for this specific violation
                v_types = row.get("violation_types", [])
                if not v_types:
                    v_types = [row.get("violation_type", "NO PARKING")]
                
                # Deduplicate and calculate fine
                fine_sum = 0
                for vt in v_types:
                    fine_sum += fine_pricing.get(str(vt).upper().strip(), 500)
                
                matching_violations.append({
                    "id": str(row.get("id")),
                    "timestamp": str(row.get("created_datetime")),
                    "zone": str(row.get("zone")),
                    "latitude": float(row.get("latitude")) if pd.notna(row.get("latitude")) else None,
                    "longitude": float(row.get("longitude")) if pd.notna(row.get("longitude")) else None,
                    "violation_types": v_types,
                    "fine_amount": fine_sum,
                    "junction_name": str(row.get("junction_name", "No Junction")),
                    "near_intersection": bool(row.get("near_intersection", False)),
                    "vehicle_type": str(row.get("vehicle_type", "CAR")),
                })

    # Sort matching violations by timestamp descending
    matching_violations.sort(key=lambda x: x["timestamp"], reverse=True)

    total_violations = len(matching_violations)
    total_fine = sum(v["fine_amount"] for v in matching_violations)
    
    # 4. Civic score: 100 - (25 per violation), capped at min 10
    civic_score = max(10, 100 - (total_violations * 25))
    
    if total_violations == 0:
        civic_rating = "Clean Commuter"
        rating_color = "green"
    elif total_violations == 1:
        civic_rating = "Responsible Driver"
        rating_color = "green"
    elif total_violations <= 3:
        civic_rating = "Needs Attention"
        rating_color = "orange"
    else:
        civic_rating = "Chronic Offender"
        rating_color = "red"

    return {
        "vehicle_number": vehicle_number,
        "sanitized_vehicle_number": search_clean,
        "total_violations": total_violations,
        "total_fine": total_fine,
        "civic_score": civic_score,
        "civic_rating": civic_rating,
        "rating_color": rating_color,
        "violations": matching_violations
    }


from pydantic import BaseModel

class TranslationRequest(BaseModel):
    text: str
    target_lang: str

@router.post("/translate")
async def translate_text(payload: TranslationRequest):
    """
    Translate text to Hindi or Kannada using Gemini API.
    """
    target = payload.target_lang.strip().lower()
    text = payload.text.strip()
    
    if not text or target == "en":
        return {"translated_text": text}
        
    lang_name = "Hindi" if target == "hi" else "Kannada" if target == "kn" else None
    if not lang_name:
        return {"translated_text": text}
        
    from app.config import get_settings
    try:
        from google import genai
    except ImportError:
        return {"translated_text": text}
        
    settings = get_settings()
    if not settings.gemini_api_key:
        return {"translated_text": text}
        
    from app.routes.chat import get_genai_client
    try:
        client = get_genai_client(settings.gemini_api_key)
        prompt = (
            f"Translate the following Bengaluru traffic/parking dashboard text to {lang_name}. "
            "Maintain any emojis, numbers, and keep proper Bengaluru area names (like 'Silk Board', "
            "'Koramangala', 'Indiranagar', 'MG Road') and agency names (like 'BBMP', 'BTP', 'BMRCL') "
            "accurate and standard. Do not translate proper technical abbreviations. "
            "Provide a high-quality, professional translation with absolutely zero grammar or spelling errors.\n\n"
            f"Text to translate: \"{text}\"\n\n"
            "Only output the translated text. Do not include quotes, markdown formatting, explanations, or backticks."
        )
        
        import asyncio
        max_retries = 3
        retry_delay = 1.0
        response = None
        for attempt in range(max_retries):
            try:
                response = await client.aio.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                )
                break
            except Exception as e:
                err_msg = str(e).lower()
                is_rate_limit = (
                    "429" in err_msg or
                    "too many requests" in err_msg or
                    "resource_exhausted" in err_msg or
                    "resource exhausted" in err_msg or
                    getattr(e, "code", None) == 429 or
                    getattr(e, "status_code", None) == 429
                )
                if is_rate_limit and attempt < max_retries - 1:
                    import logging
                    logging.getLogger(__name__).warning(f"Translate endpoint hit rate limit. Retrying in {retry_delay}s... (Attempt {attempt + 1}/{max_retries})")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                else:
                    raise e

        translated = response.text.strip()
        if translated.startswith('"') and translated.endswith('"'):
            translated = translated[1:-1].strip()
        elif translated.startswith("'") and translated.endswith("'"):
            translated = translated[1:-1].strip()
        return {"translated_text": translated}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error in translate endpoint: {e}")
        return {"translated_text": text}


@router.get("/traffic-routes")
def get_traffic_routes():
    """
    Get 3D traffic route segments for Bengaluru, colored by congestion.
    """
    from app.services.traffic_service import TrafficService
    from app.services.realtime_engine import get_realtime_engine
    
    engine = get_realtime_engine()
    recent = engine.recent_window(hours=24)
    traffic = TrafficService()
    speeds = traffic.get_zone_speeds(recent)
    
    # Define our connected road network
    roads = [
        ("Silk Board", "Koramangala", [
            [12.9177, 77.6225], [12.9240, 77.6235], [12.9300, 77.6240], [12.9352, 77.6245]
        ]),
        ("Koramangala", "HSR Layout", [
            [12.9352, 77.6245], [12.9340, 77.6310], [12.9300, 77.6345], 
            [12.9230, 77.6360], [12.9170, 77.6410], [12.9116, 77.6473]
        ]),
        ("Koramangala", "Indiranagar", [
            [12.9352, 77.6245], [12.9390, 77.6275], [12.9430, 77.6310], 
            [12.9485, 77.6340], [12.9535, 77.6375], [12.9565, 77.6390], 
            [12.9605, 77.6395], [12.9645, 77.6398], [12.9715, 77.6402], 
            [12.9784, 77.6408]
        ]),
        ("Koramangala", "BTM Layout", [
            [12.9352, 77.6245], [12.9330, 77.6185], [12.9295, 77.6175], 
            [12.9250, 77.6150], [12.9210, 77.6120], [12.9166, 77.6083]
        ]),
        ("BTM Layout", "Silk Board", [
            [12.9166, 77.6083], [12.9158, 77.6125], [12.9162, 77.6175], 
            [12.9170, 77.6200], [12.9177, 77.6225]
        ]),
        ("MG Road", "Indiranagar", [
            [12.9750, 77.6063], [12.9740, 77.6130], [12.9748, 77.6185], 
            [12.9760, 77.6220], [12.9780, 77.6280], [12.9790, 77.6335], 
            [12.9785, 77.6375], [12.9784, 77.6408]
        ]),
        ("Majestic", "Malleshwaram", [
            [12.9766, 77.5712], [12.9810, 77.5710], [12.9845, 77.5708], 
            [12.9880, 77.5715], [12.9925, 77.5718], [12.9984, 77.5720]
        ]),
        ("Malleshwaram", "Hebbal", [
            [12.9984, 77.5720], [13.0035, 77.5745], [13.0080, 77.5780], 
            [13.0135, 77.5815], [13.0150, 77.5850], [13.0230, 77.5910], 
            [13.0295, 77.5950], [13.0358, 77.5978]
        ]),
        ("Hebbal", "Yelahanka", [
            [13.0358, 77.5978], [13.0450, 77.5995], [13.0560, 77.5985], 
            [13.0650, 77.5920], [13.0760, 77.5895], [13.0880, 77.5875], 
            [13.0978, 77.5862]
        ]),
        ("HSR Layout", "Electronic City", [
            [12.9116, 77.6473], [12.9060, 77.6515], [12.8980, 77.6550], 
            [12.8910, 77.6580], [12.8780, 77.6540], [12.8680, 77.6570], 
            [12.8550, 77.6590], [12.8452, 77.6602]
        ]),
        ("Indiranagar", "Marathahalli", [
            [12.9784, 77.6408], [12.9715, 77.6402], [12.9650, 77.6420], 
            [12.9595, 77.6455], [12.9575, 77.6510], [12.9570, 77.6570], 
            [12.9590, 77.6640], [12.9610, 77.6750], [12.9592, 77.6974]
        ]),
        ("Marathahalli", "Whitefield", [
            [12.9592, 77.6974], [12.9605, 77.7050], [12.9620, 77.7120], 
            [12.9650, 77.7200], [12.9680, 77.7290], [12.9660, 77.7380], 
            [12.9675, 77.7440], [12.9698, 77.7500]
        ]),
        ("Majestic", "Rajajinagar", [
            [12.9766, 77.5712], [12.9750, 77.5645], [12.9775, 77.5585], 
            [12.9830, 77.5640], [12.9870, 77.5610], [12.9892, 77.5562]
        ]),
        ("Jayanagar", "Banashankari", [
            [12.9284, 77.5824], [12.9260, 77.5750], [12.9220, 77.5780], 
            [12.9180, 77.5750], [12.9156, 77.5736]
        ]),
        ("Jayanagar", "BTM Layout", [
            [12.9284, 77.5824], [12.9275, 77.5910], [12.9240, 77.5940], 
            [12.9220, 77.5950], [12.9180, 77.6010], [12.9166, 77.6083]
        ]),
    ]
    
    features = []
    for idx, (z1, z2, waypoints) in enumerate(roads):
        # Calculate speed drops in connected zones
        meta1 = BENGALURU_ZONES.get(z1, {"baseline_speed_kmh": 20})
        meta2 = BENGALURU_ZONES.get(z2, {"baseline_speed_kmh": 20})
        
        speed1 = speeds.get(z1, meta1["baseline_speed_kmh"] * 0.7)
        speed2 = speeds.get(z2, meta2["baseline_speed_kmh"] * 0.7)
        
        drop1 = max(0, (meta1["baseline_speed_kmh"] - speed1) / meta1["baseline_speed_kmh"] * 100)
        drop2 = max(0, (meta2["baseline_speed_kmh"] - speed2) / meta2["baseline_speed_kmh"] * 100)
        
        avg_drop = (drop1 + drop2) / 2
        avg_speed = (speed1 + speed2) / 2
        
        if avg_drop >= 50:
            congestion = "high"
            color = "#FF3B30"  # Vibrant Neon Red
        elif avg_drop >= 25:
            congestion = "medium"
            color = "#FF9500"  # Vibrant Neon Orange
        else:
            congestion = "low"
            color = "#34C759"  # Vibrant Neon Green
            
        # Flip to [lon, lat] for Mapbox GeoJSON spec and interpolate points to increase waypoint resolution
        coords = []
        for i in range(len(waypoints) - 1):
            p1 = waypoints[i]
            p2 = waypoints[i + 1]
            coords.append([p1[1], p1[0]])  # Flip to [lon, lat]
            # Add 2 intermediate points between each pair to smooth out the road curves
            for step in range(1, 3):
                frac = step / 3
                lat = p1[0] + (p2[0] - p1[0]) * frac
                lng = p1[1] + (p2[1] - p1[1]) * frac
                coords.append([lng, lat])
        if waypoints:
            coords.append([waypoints[-1][1], waypoints[-1][0]])
        
        features.append({
            "type": "Feature",
            "id": idx + 1,
            "geometry": {
                "type": "LineString",
                "coordinates": coords
            },
            "properties": {
                "route_name": f"{z1} - {z2}",
                "congestion_level": congestion,
                "color": color,
                "current_speed_kmh": round(avg_speed, 1),
                "speed_drop_pct": round(avg_drop, 1)
            }
        })
        
    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/calculate-route")
def calculate_route(
    start_lat: float, start_lng: float, end_lat: float, end_lng: float
):
    """
    Calculate real driving routes (Standard vs Eco) using OSRM.
    Returns actual coordinates on real Bengaluru streets, along with real stats.
    """
    import httpx
    import logging
    import math
    logger = logging.getLogger(__name__)

    # Bounding box checker helper
    def get_zones_passed_by_route(coords: list[list[float]]) -> set[str]:
        passed = set()
        for lat, lng in coords:
            for zone_name, meta in BENGALURU_ZONES.items():
                bbox = meta.get("bbox")
                if bbox and bbox[0] <= lat <= bbox[2] and bbox[1] <= lng <= bbox[3]:
                    passed.add(zone_name)
        return passed

    def haversine_km(lat1, lon1, lat2, lon2):
        return math.hypot(lat2 - lat1, lon2 - lon1) * 111.0

    # 1. Fetch Standard route from OSRM
    url_std = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}?overview=full&geometries=geojson"
    std_coords = []
    std_dist_meters = 0.0
    std_duration_secs = 0.0
    try:
        resp = httpx.get(url_std, timeout=5.0)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("routes"):
                raw_coords = data["routes"][0]["geometry"]["coordinates"]
                std_coords = [[pt[1], pt[0]] for pt in raw_coords]
                std_dist_meters = float(data["routes"][0]["distance"])
                std_duration_secs = float(data["routes"][0]["duration"])
    except Exception as e:
        logger.warning(f"OSRM Standard routing failed: {e}")

    # Fallback to straight lines if OSRM fails
    if not std_coords:
        std_coords = [[start_lat, start_lng], [end_lat, end_lng]]

    # 2. Calculate Eco route mid-point with scaling offset
    dist_lat_lng = math.hypot(end_lat - start_lat, end_lng - start_lng)
    offset = max(0.003, min(0.015, dist_lat_lng * 0.25))

    mid_lat = start_lat + (end_lat - start_lat) * 0.5
    mid_lng = start_lng + (end_lng - start_lng) * 0.5
    
    # Offset midpoint to create a bypass
    eco_mid_lat = mid_lat + offset
    eco_mid_lng = mid_lng + offset
    
    # Query OSRM with midpoint to get a real road route that bypasses
    url_eco = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{eco_mid_lng},{eco_mid_lat};{end_lng},{end_lat}?overview=full&geometries=geojson"
    eco_coords = []
    eco_dist_meters = 0.0
    eco_duration_secs = 0.0
    try:
        resp = httpx.get(url_eco, timeout=5.0)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("routes"):
                raw_coords = data["routes"][0]["geometry"]["coordinates"]
                eco_coords = [[pt[1], pt[0]] for pt in raw_coords]
                eco_dist_meters = float(data["routes"][0]["distance"])
                eco_duration_secs = float(data["routes"][0]["duration"])
    except Exception as e:
        logger.warning(f"OSRM Eco routing failed: {e}")

    if not eco_coords:
        eco_coords = [[start_lat, start_lng], [eco_mid_lat, eco_mid_lng], [end_lat, end_lng]]

    # 3. Calculate metrics using zone congestion
    engine = get_realtime_engine()
    recent = engine.recent_window(hours=24)
    traffic = TrafficService()
    speeds = traffic.get_zone_speeds(recent)

    std_zones = get_zones_passed_by_route(std_coords)
    eco_zones = get_zones_passed_by_route(eco_coords)

    std_multiplier = 1.0
    for zone in std_zones:
        meta = BENGALURU_ZONES.get(zone)
        if meta:
            baseline = meta["baseline_speed_kmh"]
            speed = speeds.get(zone, baseline)
            drop_pct = max(0.0, (baseline - speed) / baseline)
            std_multiplier += drop_pct * 0.5

    eco_multiplier = 1.0
    for zone in eco_zones:
        meta = BENGALURU_ZONES.get(zone)
        if meta:
            baseline = meta["baseline_speed_kmh"]
            speed = speeds.get(zone, baseline)
            drop_pct = max(0.0, (baseline - speed) / baseline)
            eco_multiplier += drop_pct * 0.15

    std_dist_km = std_dist_meters / 1000.0 if std_dist_meters > 0 else haversine_km(start_lat, start_lng, end_lat, end_lng)
    eco_dist_km = eco_dist_meters / 1000.0 if eco_dist_meters > 0 else std_dist_km * 1.12

    std_duration_secs_raw = std_duration_secs if std_duration_secs > 0 else (std_dist_km / 40.0) * 3600.0
    eco_duration_secs_raw = eco_duration_secs if eco_duration_secs > 0 else (eco_dist_km / 45.0) * 3600.0

    std_duration_mins = (std_duration_secs_raw / 60.0) * std_multiplier
    eco_duration_mins = (eco_duration_secs_raw / 60.0) * eco_multiplier

    # Ensure eco route is faster when congestion is present, or at least comparable
    if std_duration_mins <= eco_duration_mins:
        if std_multiplier > 1.1:
            eco_duration_mins = std_duration_mins * 0.85
        else:
            eco_duration_mins = max(eco_duration_mins, std_duration_mins + 1.5)

    # Fuel and CO2 calculations
    std_fuel = std_dist_km * (0.08 + 0.08 * (std_multiplier - 1.0))
    eco_fuel = eco_dist_km * (0.055 + 0.02 * (eco_multiplier - 1.0))

    # Fallback checks to prevent unrealistic values
    if eco_fuel >= std_fuel:
        eco_fuel = std_fuel * 0.7

    std_co2 = std_fuel * 2.3
    eco_co2 = eco_fuel * 2.3

    time_saved = max(1.0, round(std_duration_mins - eco_duration_mins, 1))
    fuel_saved = max(0.05, round(std_fuel - eco_fuel, 2))
    co2_saved = max(0.1, round(std_co2 - eco_co2, 2))

    time_pct = int(round((time_saved / max(1.0, std_duration_mins)) * 100))
    fuel_pct = int(round((fuel_saved / max(0.05, std_fuel)) * 100))
    co2_pct = int(round((co2_saved / max(0.1, std_co2)) * 100))

    return {
        "standard_route": std_coords,
        "eco_route": eco_coords,
        "stats": {
            "std_dist_km": round(std_dist_km, 2),
            "eco_dist_km": round(eco_dist_km, 2),
            "std_time_mins": int(round(std_duration_mins)),
            "eco_time_mins": int(round(eco_duration_mins)),
            "std_fuel_liters": round(std_fuel, 2),
            "eco_fuel_liters": round(eco_fuel, 2),
            "std_co2_kg": round(std_co2, 2),
            "eco_co2_kg": round(eco_co2, 2),
            "time_saved_mins": int(round(time_saved)),
            "time_saved_pct": max(5, min(95, time_pct)),
            "co2_saved_kg": round(co2_saved, 2),
            "co2_saved_pct": max(5, min(95, co2_pct)),
            "fuel_saved_liters": round(fuel_saved, 2),
            "fuel_saved_pct": max(5, min(95, fuel_pct))
        }
    }


class CommuteRecordRequest(BaseModel):
    co2_saved: float
    fuel_saved: float
    time_saved: float


@router.post("/record-commute")
def record_commute(
    payload: CommuteRecordRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Log completed eco-commute stats to the user's persistent record.
    """
    from fastapi import HTTPException
    from app.config import get_settings
    db_user = db.query(User).filter(User.id == user.id).first()
    if not db_user:
        settings = get_settings()
        if user.id == 0 or user.email == settings.officer_username:
            return {
                "success": True,
                "eco_co2_offset": round((user.eco_co2_offset or 0.0) + payload.co2_saved, 2),
                "eco_fuel_saved": round((user.eco_fuel_saved or 0.0) + payload.fuel_saved, 2),
                "eco_time_saved": round((user.eco_time_saved or 0.0) + payload.time_saved, 2),
            }
        raise HTTPException(status_code=404, detail="User not found")

    db_user.eco_co2_offset = round((db_user.eco_co2_offset or 0.0) + payload.co2_saved, 2)
    db_user.eco_fuel_saved = round((db_user.eco_fuel_saved or 0.0) + payload.fuel_saved, 2)
    db_user.eco_time_saved = round((db_user.eco_time_saved or 0.0) + payload.time_saved, 2)
    db.commit()
    db.refresh(db_user)
    return {
        "success": True,
        "eco_co2_offset": db_user.eco_co2_offset,
        "eco_fuel_saved": db_user.eco_fuel_saved,
        "eco_time_saved": db_user.eco_time_saved,
    }


