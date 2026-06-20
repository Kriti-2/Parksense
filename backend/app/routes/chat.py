import asyncio
import logging
import time
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import get_settings
from app.data.loader import get_data_store
from app.services.realtime_engine import get_realtime_engine
from app.middleware.rate_limit import limiter

try:
    from google import genai
except ImportError:
    genai = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["AI Assistant"])

class ChatMessage(BaseModel):
    message: str
    stream: bool = True
    context: str = "dashboard"  # "dashboard", "login", or "citizen"

# Global client cache
_genai_client = None

def get_genai_client(api_key: str):
    global _genai_client
    if _genai_client is None:
        if genai is None:
            raise HTTPException(
                status_code=500, detail="google-genai package is not installed."
            )
        _genai_client = genai.Client(api_key=api_key)
    return _genai_client

# TTL Cache for parsed live data (15 seconds)
_live_data_cache = {
    "data": {},
    "timestamp": 0.0
}
LIVE_DATA_TTL = 15.0  # seconds

def get_cached_live_data() -> dict:
    now = time.time()
    if _live_data_cache["data"] and (now - _live_data_cache["timestamp"]) < LIVE_DATA_TTL:
        return _live_data_cache["data"]

    # Fetch live context
    try:
        realtime_payload = get_realtime_engine().get_last_tick()
    except Exception as e:
        logger.warning(f"Could not fetch realtime payload for AI context: {e}")
        realtime_payload = {}
        
    store = get_data_store()
    
    # Extract useful stats for context
    active_hotspots = 0
    if "zone_intensity" in realtime_payload:
        active_hotspots = sum(
            1 for z in realtime_payload["zone_intensity"].values() if z["congestion_score"] >= 50
        )
        
    severity_q = realtime_payload.get("severity_queue", [])
    critical_alerts = len([s for s in severity_q if s["severity"] == "CRITICAL"])
    warning_alerts = len([s for s in severity_q if s["severity"] == "WARNING"])
    
    kpis = realtime_payload.get("kpis", {})
    last_hour_violations = kpis.get("violations_last_hour", 0)
    total_violations = kpis.get("total_violations", 0)

    # Add more context
    corridors_payload = realtime_payload.get("corridors", {})
    if isinstance(corridors_payload, dict):
        top_corridors = corridors_payload.get("corridors", [])[:3]
    else:
        top_corridors = corridors_payload[:3] if corridors_payload else []
    corridor_text = "\n".join([f"- {c['name']}: {c['status']}" for c in top_corridors]) if top_corridors else "No active corridors."
    
    top_alerts = severity_q[:3]
    alerts_text = "\n".join([f"- {a['severity']}: {a.get('reason', 'Alert')} at {a.get('location_name', 'Unknown')}" for a in top_alerts]) if top_alerts else "No alerts."
    
    weather_info = realtime_payload.get("weather", {}).get("description", "Clear")

    # Fetch recidivism stubborn zones context
    try:
        recidivism_data = store.get_recidivism()
        stubborn_zones = [z["zone"] for z in recidivism_data.get("zones", []) if z.get("is_stubborn_zone")]
        stubborn_text = ", ".join(stubborn_zones[:3]) if stubborn_zones else "None"
    except Exception as e:
        logger.warning(f"Could not fetch recidivism context: {e}")
        stubborn_text = "Unknown"

    # Fetch shift recommendations context
    try:
        shift_data = store.get_shift_planner()
        recommended_shifts = []
        for recommended_zone in shift_data.get("recommendations", []):
            recommended_shifts.append(f"{recommended_zone.get('zone')} (confidence: {recommended_zone.get('confidence')})")
        shift_text = "\n".join([f"- {s}" for s in recommended_shifts[:3]]) if recommended_shifts else "No recommendations."
    except Exception as e:
        logger.warning(f"Could not fetch shift context: {e}")
        shift_text = "Unknown"

    data = {
        "weather_info": weather_info,
        "active_hotspots": active_hotspots,
        "critical_alerts": critical_alerts,
        "warning_alerts": warning_alerts,
        "last_hour_violations": last_hour_violations,
        "total_violations": total_violations,
        "corridor_text": corridor_text,
        "alerts_text": alerts_text,
        "stubborn_text": stubborn_text,
        "shift_text": shift_text
    }
    _live_data_cache["data"] = data
    _live_data_cache["timestamp"] = now
    return data

def build_dashboard_context() -> str:
    data = get_cached_live_data()
    return f"""
You are the मार्ग Sense Command Center Assistant for the Bengaluru Traffic Police.
You answer questions quickly, clearly, and concisely. Keep your answers brief unless asked for details.
If asked about current status, use the live data provided below. Do not make up data.

--- LIVE DASHBOARD CONTEXT ---
Weather: {data['weather_info']}
Active Hotspots (Congestion >= 50): {data['active_hotspots']}
Critical Alerts in Queue: {data['critical_alerts']}
Warning Alerts in Queue: {data['warning_alerts']}
Violations (Last Hour): {data['last_hour_violations']}
Total Violations Tracked: {data['total_violations']}

Top Corridors Status:
{data['corridor_text']}

Top Priority Alerts:
{data['alerts_text']}

Top Stubborn Zones (Recidivism): {data['stubborn_text']}

Recommended Officer Deployments:
{data['shift_text']}
------------------------------
"""

def build_citizen_context() -> str:
    data = get_cached_live_data()
    return f"""
You are the मार्ग Sense Citizen Assistant for the Bengaluru Traffic Public Portal.
You assist citizens with planning their commutes, reporting parking violations, and understanding traffic hot spots.
You answer questions quickly, clearly, and concisely. Keep your answers brief unless asked for details.
Do not share any details about traffic police deployments, officer names, or officer shifts/recommendations.

--- BENGALURU LIVE TRAFFIC CONTEXT ---
Weather: {data['weather_info']}
Active Congested Hotspots: {data['active_hotspots']}
Top Emergency Corridors Status:
{data['corridor_text']}
-------------------------------------

If citizens ask:
- How to report a violation: Go to the "Report Violation" tab in the citizen portal navigation, fill out the vehicle details, location, type of violation, and upload an image, then submit it.
- How to plan a trip: Go to the "Trip Planner" tab to check zone congestion scores and parking hotspot forecasts.
- Emergency Corridors: Go to the "Emergency Corridors" tab to check active green corridors and priority emergency lanes.
"""

def build_login_context() -> str:
    return """
You are the मार्ग Sense Public Assistant for the Bengaluru Traffic Police मार्ग Sense Portal.
You assist users (citizens, traffic officers, and administrators) who are trying to log in, register, or learn about the platform.
You answer questions quickly, clearly, and concisely. Keep your answers brief unless asked for details.

मार्ग Sense is a real-time smart parking violation and traffic congestion management system designed for the Bengaluru Traffic Police.
Key Features for Authorized Officers (Dashboard):
- Live Heatmaps & Congestion Monitoring (real-time active zones)
- Predictive Violation Forecasting (using time-series data)
- AI-driven Officer Deployment recommendations
- Recidivism analysis of stubborn zones

If users ask:
- How to login: Use their registered email and password on the login form. They can select "Citizen" or "Officer" modes. There are also demo credential buttons available at the bottom of the card.
- Citizen Google Sign-in: Citizens can quickly sign in using the "Sign in with Google" button.
- How to get access / sign up: Citizens can click the "Create account" link at the bottom of the login form to register. Officers must contact the administrative head or IT department of the Bengaluru Traffic Police to set up an account.
- Forgotten password: Use the password reset link or contact the administrator.
- What the platform does: मार्ग Sense aggregates and analyzes traffic parking violations in Bengaluru to manage congestion and optimize officer patrol deployments.
"""

@router.post("/")
@limiter.limit("20/minute")
async def ask_assistant(request: Request, payload: ChatMessage):
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=500, detail="Gemini API Key is not configured."
        )

    if payload.context == "login":
        context_text = build_login_context()
    elif payload.context == "citizen":
        context_text = build_citizen_context()
    else:
        context_text = build_dashboard_context()

    prompt = f"{context_text}\n\nUser Question: {payload.message}\n\nAnswer:"

    # Call Gemini API
    client = get_genai_client(settings.gemini_api_key)
    
    # Helper to check if an exception represents a 429 / rate limit
    def is_rate_limit_error(e: Exception) -> bool:
        err_msg = str(e).lower()
        return (
            "429" in err_msg or
            "too many requests" in err_msg or
            "resource_exhausted" in err_msg or
            "resource exhausted" in err_msg or
            getattr(e, "code", None) == 429 or
            getattr(e, "status_code", None) == 429 or
            str(getattr(e, "status", "")).lower() in ("too many requests", "resource_exhausted")
        )

    if payload.stream:
        async def response_generator():
            max_retries = 3
            retry_delay = 1.5
            stream = None
            for attempt in range(max_retries):
                try:
                    stream = await client.aio.models.generate_content_stream(
                        model='gemini-2.5-flash',
                        contents=prompt,
                    )
                    break
                except Exception as e:
                    if is_rate_limit_error(e) and attempt < max_retries - 1:
                        logger.warning(f"Gemini API rate limit hit. Retrying in {retry_delay}s... (Attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    else:
                        logger.error(f"Error calling Gemini API stream: {e}")
                        if is_rate_limit_error(e):
                            yield "\n[Error: The AI assistant is currently receiving too many requests. Please wait a moment before trying again.]"
                        else:
                            yield f"\n[Error: {str(e)}]"
                        return

            if stream:
                try:
                    async for chunk in stream:
                        if chunk.text:
                            yield chunk.text
                except Exception as e:
                    logger.error(f"Error during Gemini API stream consumption: {e}")
                    if is_rate_limit_error(e):
                        yield "\n[Error: The AI assistant is currently receiving too many requests. Please wait a moment before trying again.]"
                    else:
                        yield f"\n[Error: {str(e)}]"

        return StreamingResponse(response_generator(), media_type="text/plain")
    else:
        max_retries = 3
        retry_delay = 1.5
        for attempt in range(max_retries):
            try:
                response = await client.aio.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                )
                return {"response": response.text}
            except Exception as e:
                if is_rate_limit_error(e) and attempt < max_retries - 1:
                    logger.warning(f"Gemini API rate limit hit in non-stream. Retrying in {retry_delay}s... (Attempt {attempt + 1}/{max_retries})")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                else:
                    logger.error(f"Error calling Gemini API: {e}")
                    if is_rate_limit_error(e):
                        raise HTTPException(
                            status_code=429,
                            detail="The AI assistant is currently receiving too many requests. Please wait a moment before trying again."
                        )
                    raise HTTPException(status_code=500, detail=str(e))
