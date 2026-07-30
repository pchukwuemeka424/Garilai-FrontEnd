#!/usr/bin/env bash
# Build frontend static export only. Run from repo root.
# Usage:
#   NEXT_PUBLIC_FEYNMAN_BACKEND=https://api.example.com bash deploy/frontend/build.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${NEXT_PUBLIC_FEYNMAN_BACKEND:-}" ]]; then
	echo "warning: NEXT_PUBLIC_FEYNMAN_BACKEND unset — UI will use same-origin /api (fine if nginx proxies)." >&2
fi

echo "==> Installing frontend dependencies"
if [[ -f package-lock.json ]]; then npm ci; else npm install; fi

echo "==> Building Next.js static export (out/)"
NODE_ENV=production npm run build
test -f out/index.html

echo "==> Frontend build OK → out/"
echo "    Serve with nginx (deploy/frontend/nginx.host.conf) or Docker (deploy/frontend/Dockerfile)"
