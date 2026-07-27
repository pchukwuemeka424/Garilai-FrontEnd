# Frontend deployment — Coolify / VPS

Next.js **static export** (`out/`), served by nginx. The browser calls the backend via `NEXT_PUBLIC_FEYNMAN_BACKEND`.

## Coolify

1. Application → this Git repo (`Garilai-FrontEnd`).
2. **Build Pack:** Dockerfile (root `Dockerfile`).
3. **Port:** `80`
4. **Health check:** `/healthz`
5. **Build-time env / ARG:**

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_FEYNMAN_BACKEND` | `https://api.your.domain` (backend Coolify URL) |

No trailing slash. Must be reachable from the user’s browser (HTTPS in production).

## Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_FEYNMAN_BACKEND=https://api.example.com \
  -t garilai-frontend .

docker run --rm -p 8080:80 garilai-frontend
```

## Manual VPS (nginx on host)

```bash
export NEXT_PUBLIC_FEYNMAN_BACKEND=https://api.your.domain
npm ci && npm run build

sudo mkdir -p /var/www/garilai-frontend
sudo rsync -a --delete out/ /var/www/garilai-frontend/
sudo cp deploy/nginx.host.conf /etc/nginx/sites-available/garilai-frontend
# replace WEB_DOMAIN, set root to /var/www/garilai-frontend
sudo ln -sfn /etc/nginx/sites-available/garilai-frontend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d www.your.domain
```

## Same-domain alternative

Build **without** `NEXT_PUBLIC_FEYNMAN_BACKEND` and uncomment `/api` + `/ws` proxy blocks in `deploy/nginx.host.conf` so the browser stays same-origin with a backend on `127.0.0.1:3141`.
