# GARIL AI — deployment

Two Coolify/VPS apps (recommended), or one all-in-one container.

| Path | Role |
|------|------|
| [backend/](backend/) | Fastify API (`/api`, `/ws`) |
| [frontend/](frontend/) | Next static export + nginx |
| [all-in-one/](all-in-one/) | Single process: API + UI |
| [minio/](minio/) | S3-compatible object storage (MinIO) |
| `../docker-compose.yml` | mongo + backend + frontend |

---

## Coolify — two resources (recommended)

### 1. Backend

- Dockerfile: `deploy/backend/Dockerfile`
- Port: `3141`
- Health: `/api/health`
- Env: copy from `deploy/backend/.env.example`
- VPS: `sudo bash deploy/backend/setup-vps.sh`

Standalone API repo: https://github.com/pchukwuemeka424/garila-backend (`sudo bash setup-vps.sh`)


### 2. Frontend

- Dockerfile: `deploy/frontend/Dockerfile`
- Port: `80`
- Health: `/healthz`
- **Build arg / env:** `NEXT_PUBLIC_FEYNMAN_BACKEND` = public URL of the backend resource  
  (e.g. `https://xxxx.sslip.io` or `https://api.your.domain`)

Details: [backend/README.md](backend/README.md) · [frontend/README.md](frontend/README.md)

### Auto-deploy on GitHub push

Coolify **Auto Deploy** is on for both production apps. A push to `main` on the standalone GitHub repos queues a rebuild:

| App | GitHub repo | Coolify app |
|-----|-------------|-------------|
| Frontend | https://github.com/pchukwuemeka424/Garilai-FrontEnd | `garilai.com` |
| Backend | https://github.com/pchukwuemeka424/garila-backend | `api.garilai.com` |

GitHub sends `push` events to Coolify at `/webhooks/source/github/events/manual`. Include `[skip cd]` or `[skip ci]` in a commit message to skip that deploy.

The combined repo https://github.com/pchukwuemeka424/Garil-AI is the source of truth. After changing it, sync and push the two standalone repos so Coolify picks up the release.

---

## Docker Compose (local / VPS)

```bash
cp deploy/backend/.env.example backend/.env
# set OPENROUTER_API_KEY, AUTH_SECRET

export NEXT_PUBLIC_FEYNMAN_BACKEND=http://localhost:3141
docker compose up -d --build

# UI  http://localhost:8080
# API http://localhost:3141/api/health
```

---

## All-in-one (single domain)

```bash
docker build -f deploy/all-in-one/Dockerfile -t garil-ai .
# or root Dockerfile
sudo bash deploy/all-in-one/setup-vps.sh /var/www/garil-ai
```

See [all-in-one/](all-in-one/) for nginx, systemd, PM2.

---

## S3 storage (MinIO on VPS)

```bash
sudo bash deploy/minio/setup-vps.sh
# API https://s3.garilai.com  · Console https://minio.garilai.com
```

See [minio/README.md](minio/README.md).

---

## Architecture

```
Split:
  Browser → frontend :80 (static)
         → backend  :3141 (/api, /ws)   via NEXT_PUBLIC_FEYNMAN_BACKEND

All-in-one:
  Browser → nginx → Node :3141 (static + /api + /ws)

Object storage:
  App / AWS SDK → https://s3.garilai.com  (MinIO)
  Admin UI      → https://minio.garilai.com
```
