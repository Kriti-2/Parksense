# Phase 2 — Production Backend

JWT auth, rate limiting, Celery workers, Docker, and GitHub Actions CI/CD.

## Authentication

| Endpoint | Auth | Role |
|----------|------|------|
| `POST /ingest/violation` | `X-API-Key` or Bearer JWT | ingest |
| `GET /shift-planner` | Bearer JWT | officer |
| `GET /severity-queue` | Bearer JWT | officer |
| `POST /jobs/*` | Bearer JWT | officer |
| `GET /analytics`, `/heatmap`, etc. | Public (rate limited) | — |

### Officer login

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"officer","password":"margsense-demo"}'
```

Use the token:

```bash
curl http://localhost:8000/shift-planner \
  -H "Authorization: Bearer <token>"
```

### BTP ingest (API key)

```bash
curl -X POST http://localhost:8000/ingest/violation \
  -H "X-API-Key: your-ingest-key" \
  -H "Content-Type: application/json" \
  -d '{"latitude":12.9352,"longitude":77.6245,"violation_types":["NO PARKING"]}'
```

Set `AUTH_ENABLED=true` in production. Local dev defaults to `AUTH_ENABLED=false`.

## Rate limits

| Tier | Default | Routes |
|------|---------|--------|
| Public | 120/min | analytics, heatmap, predictions |
| Ingest | 60/min | `/ingest/violation` |
| Officer | 100/min | shift-planner, severity-queue, jobs |
| Auth | 20/min | `/auth/login` |

Configure via `RATE_LIMIT_*` env vars.

## Celery (heavy jobs)

Offloads Prophet forecasting and cache warming from the API process.

```bash
# Terminal 1 — Redis
docker run -p 6379:6379 redis:7-alpine

# Terminal 2 — API
CELERY_ENABLED=true python run.py

# Terminal 3 — Worker
celery -A app.celery_app worker --loglevel=info

# Terminal 4 — Beat (optional scheduled jobs)
celery -A app.celery_app beat --loglevel=info
```

### Queue jobs (officer JWT required)

```bash
curl -X POST http://localhost:8000/jobs/prophet-forecast \
  -H "Authorization: Bearer <officer-token>"

curl http://localhost:8000/jobs/<task_id> \
  -H "Authorization: Bearer <officer-token>"
```

## Docker

```bash
cp backend/.env.docker backend/.env.docker   # already in repo
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |

Services: `api`, `celery-worker`, `celery-beat`, `redis`, `frontend`.

## CI/CD

GitHub Actions workflow: `.github/workflows/ci.yml`

- Backend pytest (auth + rate limit smoke tests)
- Frontend production build
- Docker image build + API health smoke test

## Environment variables

See `backend/.env.example` for full list. Production minimum:

```env
AUTH_ENABLED=true
JWT_SECRET=<openssl rand -hex 32>
INGEST_API_KEY=<btp-webhook-key>
CELERY_ENABLED=true
REDIS_URL=redis://redis:6379/0
```
