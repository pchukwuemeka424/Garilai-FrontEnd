# Frontend — VPS / Coolify

Next.js **static export** (`out/`), served by nginx. Talks to the backend via `NEXT_PUBLIC_FEYNMAN_BACKEND`.

## Coolify (separate resource)

1. New application → same Git repo.
2. **Dockerfile location:** `deploy/frontend/Dockerfile`
3. **Port:** `80`
4. **Health check:** `/healthz`
5. **Build-time env / ARG:**

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_FEYNMAN_BACKEND` | `https://api.your.domain` (your Coolify backend URL) |

Must match the public URL of the **backend** Coolify resource (HTTPS, no trailing slash).

## Docker

```bash
docker build -f deploy/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_FEYNMAN_BACKEND=https://api.example.com \
  -t garil-frontend .

docker run --rm -p 8080:80 garil-frontend
```

## Manual VPS

```bash
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
