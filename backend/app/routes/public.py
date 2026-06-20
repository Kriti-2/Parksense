from datetime import datetime

from fastapi import APIRouter, Depends

from app.auth.dependencies import require_user
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
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
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

