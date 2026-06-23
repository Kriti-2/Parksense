# Live Mode — Real-Time Bengaluru Data

MargSense runs in **live mode** by default. The dashboard updates every 30 seconds via WebSocket without manual refresh.

## What is live

| Signal | Source |
|--------|--------|
| **Violations** | Real Bengaluru police dataset (298K records) + live replay stream |
| **Traffic speeds** | Google Maps / TomTom API (if key set) OR violation-density model |
| **Corridors** | Real violation counts in last 24h window (no mock data) |
| **Dashboard** | WebSocket `/live/ws` pushes updates every 30s |

## Optional: Live traffic API

Add to `backend/.env`:

```env
GOOGLE_MAPS_API_KEY=your_key_here
# or
TOMTOM_API_KEY=your_key_here
```

Without a key, congestion uses **real violation density** from the dataset — still real Bengaluru data, not random simulation.

## Ingest a violation (demo / BTP webhook)

```bash
curl -X POST http://localhost:8000/ingest/violation \
  -H "Content-Type: application/json" \
  -d '{"latitude": 12.975, "longitude": 77.606, "vehicle_type": "CAR", "violation_types": ["NO PARKING"]}'
```

The violation appears on the dashboard immediately via WebSocket.

## WebSocket

Connect to `ws://localhost:8000/live/ws` (or via Vite proxy: `ws://localhost:5173/api/live/ws`).

## Production path (BTP / SCITA)

Replace the replay engine with a webhook from Bangalore Traffic Police — same `/ingest/violation` endpoint, same schema as the hackathon CSV.
