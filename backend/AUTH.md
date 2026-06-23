# MargSense — Authentication

## Roles

| Role | Access |
|------|--------|
| **user** | `/congestion` — live trip planner, avoid hotspots |
| **officer** | Full command center — dashboard, predict, analytics, corridors |

## Demo accounts (auto-seeded on startup)

| Email | Password | Role |
|-------|----------|------|
| `user@margsense.demo` | `user123` | Citizen |
| `officer@margsense.demo` | `officer123` | Officer |

## User registration

`POST /auth/register` — creates a `user` role account.

## Officer Google OAuth

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google+ / OAuth consent screen
3. Create OAuth 2.0 Client ID (Web application)
4. Authorized redirect URI: `http://localhost:8000/auth/google/callback`
5. Add to `backend/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret
JWT_SECRET=long-random-production-secret
FRONTEND_URL=http://localhost:5173
```

Officers click **Sign in with Google** on the login page.

## JWT

Tokens expire after 7 days (configurable via `JWT_EXPIRE_MINUTES`).

Protected endpoints require header: `Authorization: Bearer <token>`

## User API

`GET /public/congestion-preview` — zone advisories (AVOID / CAUTION / CLEAR) for trip planning.
