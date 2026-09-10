# Frontend — VPS / Coolify

The Coolify **Dockerfile** builds Next.js in **standalone** mode (`GARIL_STATIC_EXPORT=0`) and runs `node server.js` on port `80`. That is the recommended path for dynamic App Router routes (portal, admin, etc.).

An older **static export** path (`out/` + nginx) remains available for manual VPS deploys when `GARIL_STATIC_EXPORT` is unset and production uses `output: "export"` in `next.config.ts`. Prefer standalone unless you intentionally need a pure static site.

Talks to the backend via `NEXT_PUBLIC_FEYNMAN_BACKEND` (or same-origin proxy).

## Coolify (separate resource)

1. New application → same Git repo.
2. **Dockerfile location:** `deploy/frontend/Dockerfile`
3. **Port:** `80`
4. **Health check:** `/healthz`
5. **Build-time env / ARG:**

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_FEYNMAN_BACKEND` | `https://api.your.domain` (your Coolify backend URL) |

Must match the public URL of the **backend** Coolify resource (HTTPS, no trailing slash). Leave empty only if the browser will call the API same-origin via a reverse proxy.

## Docker (standalone — matches Dockerfile)

```bash
docker build -f deploy/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_FEYNMAN_BACKEND=https://api.example.com \
  -t garil-frontend .

docker run --rm -p 8080:80 garil-frontend
```

## Manual VPS (static export + nginx)

Use this only when you want the classic `out/` + nginx layout (not the Coolify Dockerfile):

```bash
# Do not set GARIL_STATIC_EXPORT=0 — allow production static export
export NEXT_PUBLIC_FEYNMAN_BACKEND=https://api.your.domain
bash deploy/frontend/build.sh

sudo mkdir -p /var/www/garil-ai
sudo rsync -a --delete out/ /var/www/garil-ai/out/
sudo cp deploy/frontend/nginx.host.conf /etc/nginx/sites-available/garil-frontend
# replace WEB_DOMAIN
sudo ln -sfn /etc/nginx/sites-available/garil-frontend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d www.your.domain
```

## Same-domain alternative

Build **without** `NEXT_PUBLIC_FEYNMAN_BACKEND` and uncomment `/api` + `/ws` proxy blocks in `nginx.host.conf` so the browser stays same-origin.

See also [docs/PROJECT_MANUAL.md](../../docs/PROJECT_MANUAL.md) §17 (standalone vs static export).
