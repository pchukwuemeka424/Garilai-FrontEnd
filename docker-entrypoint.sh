#!/bin/sh
set -eu
PORT="${PORT:-80}"
# Coolify injects PORT; default 80 for local docker run
sed "s/__PORT__/${PORT}/g" /etc/nginx/nginx-app.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
