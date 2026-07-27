# Garilai-FrontEnd

GARIL AI web UI (Next.js static export). Deploy separately from the API.

## Setup

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_FEYNMAN_BACKEND=https://your-api.example.com
npm install
npm run dev
```

## Coolify / Docker

- **Dockerfile** at repo root
- **Port:** `80`
- **Health:** `/healthz`
- **Build arg:** `NEXT_PUBLIC_FEYNMAN_BACKEND` = public backend URL

```bash
docker build \
  --build-arg NEXT_PUBLIC_FEYNMAN_BACKEND=https://api.example.com \
  -t garilai-frontend .
```
