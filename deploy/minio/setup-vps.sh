#!/usr/bin/env bash
# Install MinIO (S3-compatible) on a Coolify/Docker VPS.
# Usage:
#   sudo bash deploy/minio/setup-vps.sh
#   sudo S3_API_HOST=s3.example.com S3_CONSOLE_HOST=minio.example.com bash deploy/minio/setup-vps.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
	echo "Run as root: sudo bash deploy/minio/setup-vps.sh" >&2
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${MINIO_INSTALL_DIR:-/opt/garil-minio}"
S3_API_HOST="${S3_API_HOST:-s3.garilai.com}"
S3_CONSOLE_HOST="${S3_CONSOLE_HOST:-minio.garilai.com}"
BUCKET="${MINIO_BUCKET:-garil}"

if ! command -v docker >/dev/null 2>&1; then
	echo "Docker is required (Coolify VPS already has it)." >&2
	exit 1
fi

if ! docker network inspect coolify >/dev/null 2>&1; then
	echo "Docker network 'coolify' not found — is Coolify installed?" >&2
	exit 1
fi

mkdir -p "$INSTALL_DIR"
cp "$SCRIPT_DIR/docker-compose.yml" "$INSTALL_DIR/docker-compose.yml"

if [[ ! -f "$INSTALL_DIR/.env" ]]; then
	if [[ -f "$SCRIPT_DIR/.env" ]]; then
		cp "$SCRIPT_DIR/.env" "$INSTALL_DIR/.env"
	elif [[ -f "$SCRIPT_DIR/.env.example" ]]; then
		cp "$SCRIPT_DIR/.env.example" "$INSTALL_DIR/.env"
		# Generate secrets if still placeholders
		ROOT_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
		APP_SECRET="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
		APP_KEY="garil$(openssl rand -hex 6)"
		sed -i "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=${ROOT_PASS}|" "$INSTALL_DIR/.env"
		sed -i "s|^MINIO_SECRET_KEY=.*|MINIO_SECRET_KEY=${APP_SECRET}|" "$INSTALL_DIR/.env"
		sed -i "s|^MINIO_ACCESS_KEY=.*|MINIO_ACCESS_KEY=${APP_KEY}|" "$INSTALL_DIR/.env"
		echo "Created $INSTALL_DIR/.env with generated secrets"
	else
		echo "Missing .env.example at $SCRIPT_DIR" >&2
		exit 1
	fi
fi

# Force public URLs / hosts for this install
sed -i "s|^MINIO_SERVER_URL=.*|MINIO_SERVER_URL=https://${S3_API_HOST}|" "$INSTALL_DIR/.env"
sed -i "s|^MINIO_BROWSER_REDIRECT_URL=.*|MINIO_BROWSER_REDIRECT_URL=https://${S3_CONSOLE_HOST}|" "$INSTALL_DIR/.env"
sed -i "s|^S3_API_HOST=.*|S3_API_HOST=${S3_API_HOST}|" "$INSTALL_DIR/.env"
sed -i "s|^S3_CONSOLE_HOST=.*|S3_CONSOLE_HOST=${S3_CONSOLE_HOST}|" "$INSTALL_DIR/.env"
grep -q '^MINIO_BUCKET=' "$INSTALL_DIR/.env" || echo "MINIO_BUCKET=${BUCKET}" >>"$INSTALL_DIR/.env"
sed -i "s|^MINIO_BUCKET=.*|MINIO_BUCKET=${BUCKET}|" "$INSTALL_DIR/.env"

echo "==> Starting MinIO in $INSTALL_DIR"
(
	cd "$INSTALL_DIR"
	docker compose --env-file .env up -d
)

# Attach to Coolify Traefik network (idempotent)
docker network connect coolify garil-minio 2>/dev/null || true

# Traefik dynamic routes
PROXY_DIR="/data/coolify/proxy/dynamic"
if [[ -d "$PROXY_DIR" ]]; then
	echo "==> Writing Traefik routes for ${S3_API_HOST} / ${S3_CONSOLE_HOST}"
	cat >"${PROXY_DIR}/garil-minio.yaml" <<YAML
http:
  routers:
    garil-minio-api-https:
      rule: "Host(\`${S3_API_HOST}\`)"
      entryPoints:
        - https
      service: garil-minio-api
      tls:
        certResolver: letsencrypt
      priority: 100
    garil-minio-api-http:
      rule: "Host(\`${S3_API_HOST}\`)"
      entryPoints:
        - http
      middlewares:
        - garil-minio-https-redirect
      service: garil-minio-api
      priority: 100
    garil-minio-console-https:
      rule: "Host(\`${S3_CONSOLE_HOST}\`)"
      entryPoints:
        - https
      service: garil-minio-console
      tls:
        certResolver: letsencrypt
      priority: 100
    garil-minio-console-http:
      rule: "Host(\`${S3_CONSOLE_HOST}\`)"
      entryPoints:
        - http
      middlewares:
        - garil-minio-https-redirect
      service: garil-minio-console
      priority: 100
  middlewares:
    garil-minio-https-redirect:
      redirectScheme:
        scheme: https
        permanent: true
  services:
    garil-minio-api:
      loadBalancer:
        servers:
          - url: "http://garil-minio:9000"
    garil-minio-console:
      loadBalancer:
        servers:
          - url: "http://garil-minio:9001"
YAML
	chmod 644 "${PROXY_DIR}/garil-minio.yaml"
else
	echo "Warn: $PROXY_DIR missing — MinIO is local-only on 127.0.0.1:9000/9001"
fi

# Wait for health
echo "==> Waiting for MinIO health..."
for i in $(seq 1 30); do
	if curl -sf http://127.0.0.1:9000/minio/health/live >/dev/null; then
		break
	fi
	sleep 2
done
curl -sf http://127.0.0.1:9000/minio/health/live >/dev/null || {
	echo "MinIO health check failed" >&2
	docker logs garil-minio --tail 40 >&2 || true
	exit 1
}

# Re-run init if needed
(
	cd "$INSTALL_DIR"
	docker compose --env-file .env run --rm minio-init
) || true

echo ""
echo "==> MinIO is up"
echo "    API:     https://${S3_API_HOST}"
echo "    Console: https://${S3_CONSOLE_HOST}"
echo "    Env:     $INSTALL_DIR/.env"
echo "    Local:   http://127.0.0.1:9000  (API) / http://127.0.0.1:9001 (console)"
echo ""
echo "    Cloudflare DNS: point ${S3_API_HOST} and ${S3_CONSOLE_HOST} to this VPS"
echo "    (orange-cloud OK; use Full SSL if origin has Let's Encrypt certs)"
echo ""
grep -E '^(MINIO_ROOT_USER|MINIO_ACCESS_KEY|MINIO_BUCKET|MINIO_SERVER_URL)=' "$INSTALL_DIR/.env" || true
echo "    (passwords are in $INSTALL_DIR/.env — keep private)"
echo ""
