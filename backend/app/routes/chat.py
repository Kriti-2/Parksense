import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.data.loader import get_data_store
from app.services.realtime_engine import get_realtime_engine
from app.middleware.rate_limit import limiter
from fastapi import Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["AI Assistant"])

class ChatMessage(BaseModel):
    message: str

@router.post("/")
@limiter.limit("20/minute")
async def ask_assistant(request: Request, payload: ChatMessage):
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=500, detail="Gemini API Key is not configured."
        )

    try:
        from google import genai
    except ImportError:
        raise HTTPException(
            status_code=500, detail="google-genai package is not installed."
        )

    # 1. Fetch live context
    try:
        realtime_payload = get_realtime_engine().tick()
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
    top_corridors = realtime_payload.get("corridors", [])[:3]
    corridor_text = "\n".join([f"- {c['name']}: {c['status']}" for c in top_corridors]) if top_corridors else "No active corridors."
    
    top_alerts = severity_q[:3]
    alerts_text = "\n".join([f"- {a['severity']}: {a.get('reason', 'Alert')} at {a.get('location_name', 'Unknown')}" for a in top_alerts]) if top_alerts else "No alerts."
    
    weather_info = realtime_payload.get("weather", {}).get("description", "Clear")

    # 2. Build the system prompt
    context_text = f"""
You are the ParkSense AI Command Center Assistant for the Bengaluru Traffic Police.
You answer questions quickly, clearly, and concisely. Keep your answers brief unless asked for details.
If asked about current status, use the live data provided below. Do not make up data.

--- LIVE DASHBOARD CONTEXT ---
Weather: {weather_info}
Active Hotspots (Congestion >= 50): {active_hotspots}
Critical Alerts in Queue: {critical_alerts}
Warning Alerts in Queue: {warning_alerts}
Violations (Last Hour): {last_hour_violations}
Total Violations Tracked: {total_violations}

Top Corridors Status:
{corridor_text}

Top Priority Alerts:
{alerts_text}
------------------------------
"""

    prompt = f"{context_text}\n\nUser Question: {payload.message}\n\nAnswer:"

    # 3. Call Gemini API
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = await client.aio.models.generate_content(
            model='gemini-2.0-flash-lite',
            contents=prompt,
        )
        return {"response": response.text}
    except Exception as e:
        logger.error(f"Error calling Gemini API: {e}")
        raise HTTPException(status_code=500, detail=str(e))
