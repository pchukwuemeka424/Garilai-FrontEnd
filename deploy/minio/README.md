# MinIO — S3-compatible storage on VPS

Self-hosted object storage for uploads, backups, and app assets.

| Item | Value |
|------|--------|
| API | `https://s3.garilai.com` |
| Console | `https://minio.garilai.com` |
| Default bucket | `garil` |
| Install path | `/opt/garil-minio` |

## Coolify VPS (one command)

From the monorepo on the server (or copy `deploy/minio/` to the VPS):

```bash
sudo bash deploy/minio/setup-vps.sh
```

Custom hosts:

```bash
sudo S3_API_HOST=s3.your.domain S3_CONSOLE_HOST=minio.your.domain \
  bash deploy/minio/setup-vps.sh
```

The script:

1. Starts MinIO via Docker Compose under `/opt/garil-minio`
2. Attaches the container to the `coolify` network
3. Writes Traefik routes in `/data/coolify/proxy/dynamic/garil-minio.yaml`
4. Creates bucket + app access key

## DNS / Cloudflare

Create A/CNAME records for:

- `s3.garilai.com` → VPS (or Cloudflare proxied)
- `minio.garilai.com` → VPS (or Cloudflare proxied)

SSL: Cloudflare **Full** (strict if origin cert is valid).

## App env (backend)

Add to `backend/.env` or Coolify Environment:

```bash
S3_ENDPOINT=https://s3.garilai.com
S3_REGION=us-east-1
S3_BUCKET=garil
S3_ACCESS_KEY=...   # MINIO_ACCESS_KEY from /opt/garil-minio/.env
S3_SECRET_KEY=...   # MINIO_SECRET_KEY
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=https://s3.garilai.com
```

Backend helpers: `backend/src/config/env.ts` (`isS3Enabled`, `getS3Config`) and
`backend/src/services/s3.service.ts` (`putObject`, `getObject`, `deleteObject`, presigned URLs).
`GET /api/health` reports `{ s3: { enabled, ok, bucket, endpoint } }`.

## Local / non-Coolify

```bash
cp deploy/minio/.env.example deploy/minio/.env
# edit secrets; set MINIO_SERVER_URL=http://127.0.0.1:9000
docker compose -f deploy/minio/docker-compose.yml --env-file deploy/minio/.env up -d
```

## Useful commands

```bash
docker ps --filter name=garil-minio
docker logs -f garil-minio
curl -s http://127.0.0.1:9000/minio/health/live
cd /opt/garil-minio && docker compose --env-file .env down
```
