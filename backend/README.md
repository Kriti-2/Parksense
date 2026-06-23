# MargSense Backend

FastAPI backend for parking congestion intelligence in Bengaluru.

## Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env
python run.py
```

API runs at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/heatmap` | GeoJSON violation heatmap |
| GET | `/analytics` | KPIs, congestion fingerprints, economic loss |
| GET | `/predictions` | Top 10 high-risk zones (24h forecast) |
| GET | `/severity-queue` | Prioritized violation severity queue |
| GET | `/recidivism` | Repeat offender zone analysis |
| GET | `/corridors` | Emergency corridor status |
| GET | `/shift-planner` | Officer deployment recommendations |

## Data

Place the Flipkart Gridlock hackathon CSV at the project root (auto-detected) or set `VIOLATIONS_CSV_PATH` in `.env`.
