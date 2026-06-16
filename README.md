# ParkSense AI

**Not just where violations happen — but what they cost, where they'll happen next, and exactly how many officers to deploy where.**

AI-powered parking congestion intelligence platform for Bengaluru.

## Project Structure

```
parksense/
├── backend/          # FastAPI + Prophet + Pandas
│   ├── app/
│   │   ├── models/   # Congestion, severity, forecaster
│   │   ├── services/ # Economic, recidivism, corridors, shift planner
│   │   ├── routes/   # API endpoints
│   │   ├── data/     # CSV loader
│   │   └── utilities/
│   └── requirements.txt
├── frontend/         # React 18 + Vite + Tailwind + Recharts
└── jan to may police violation_anonymized791b166 (2).csv
```

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python run.py
```

API: http://localhost:8000 · Docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173

## API Endpoints

| Endpoint | Module |
|----------|--------|
| `GET /heatmap` | Violation GeoJSON heatmap |
| `GET /analytics` | KPIs + economic loss + trends |
| `GET /predictions` | ParkPredict 24h forecast |
| `GET /severity-queue` | Violation severity classifier |
| `GET /recidivism` | Recidivism heatmap engine |
| `GET /corridors` | Green corridor protector |
| `GET /shift-planner` | Officer deployment planner |
| `GET /live/status` | Live data source status |
| `WS /live/ws` | Real-time WebSocket updates (30s) |
| `POST /ingest/violation` | Ingest live violation |

**Live mode:** See [backend/LIVE.md](backend/LIVE.md) — real Bengaluru violations stream + optional Google Maps/TomTom traffic.

- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Axios, React Router, Leaflet
- **Backend:** Python, FastAPI, Pandas, NumPy, Prophet, Scikit-Learn, SQLite, APScheduler

## Bengaluru Zones

Koramangala · HSR Layout · Indiranagar · MG Road · Silk Board · Whitefield
