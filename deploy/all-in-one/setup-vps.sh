#!/usr/bin/env bash
# Install GARIL AI all-in-one on a Debian/Ubuntu VPS.
# Usage: sudo bash deploy/all-in-one/setup-vps.sh [/var/www/garil-ai]
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
	echo "Run as root: sudo bash deploy/all-in-one/setup-vps.sh [APP_DIR]" >&2
	exit 1
fi

APP_DIR="${1:-/var/www/garil-ai}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVICE_USER="${GARIL_SERVICE_USER:-www-data}"

echo "==> App directory: $APP_DIR"
echo "==> Source repo:   $REPO_ROOT"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg nginx

need_node=0
if ! command -v node >/dev/null 2>&1; then
	need_node=1
else
	major="$(node -v | sed 's/^v//' | cut -d. -f1)"
	if [[ "$major" -lt 20 || "$major" -ge 26 ]]; then
		need_node=1
	fi
fi

if [[ "$need_node" -eq 1 ]]; then
	echo "==> Installing Node.js 22.x"
	curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
	apt-get install -y nodejs
fi

echo "==> Node $(node -v) / npm $(npm -v)"

if [[ "$REPO_ROOT" != "$APP_DIR" ]]; then
	echo "==> Syncing project to $APP_DIR"
	mkdir -p "$APP_DIR"
	rsync -a --delete \
		--exclude node_modules \
		--exclude backend/node_modules \
		--exclude .git \
		--exclude .env \
		--exclude backend/.env \
		--exclude .next \
		"$REPO_ROOT/" "$APP_DIR/"
fi

if [[ ! -f "$APP_DIR/backend/.env" ]]; then
	if [[ -f "$APP_DIR/.env" ]]; then
		cp "$APP_DIR/.env" "$APP_DIR/backend/.env"
	elif [[ -f "$APP_DIR/deploy/backend/.env.example" ]]; then
		cp "$APP_DIR/deploy/backend/.env.example" "$APP_DIR/backend/.env"
		echo "Created $APP_DIR/backend/.env from example — edit secrets before starting."
	elif [[ -f "$APP_DIR/.env.example" ]]; then
		cp "$APP_DIR/.env.example" "$APP_DIR/backend/.env"
		echo "Created $APP_DIR/backend/.env from example — edit secrets before starting."
	fi
fi

echo "==> Building application"
(
	cd "$APP_DIR"
	bash scripts/deploy-build.sh
)

echo "==> Installing systemd unit"
sed "s|/var/www/garil-ai|$APP_DIR|g" "$SCRIPT_DIR/garil-ai.service" \
	>"/etc/systemd/system/garil-ai.service"
sed -i "s|^ExecStart=.*|ExecStart=$(command -v node) backend/dist/index.js|" \
	/etc/systemd/system/garil-ai.service

id "$SERVICE_USER" >/dev/null 2>&1 || SERVICE_USER=root
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
mkdir -p "$APP_DIR/backend/backups"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/backend/backups"

systemctl daemon-reload
systemctl enable garil-ai.service

echo "==> Installing nginx site"
cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/garil-ai
ln -sfn /etc/nginx/sites-available/garil-ai /etc/nginx/sites-enabled/garil-ai
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo ""
echo "==> Setup complete. Next steps:"
echo "    1. Edit secrets:  nano $APP_DIR/backend/.env"
echo "    2. Edit domain:   nano /etc/nginx/sites-available/garil-ai"
echo "    3. Start app:     systemctl start garil-ai"
echo "    4. HTTPS:         certbot --nginx -d your.domain"
echo "    5. Health check:  curl -s http://127.0.0.1:3141/api/health"
echo ""
