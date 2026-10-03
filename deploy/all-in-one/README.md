# All-in-one VPS deploy

Single Fastify process serves `out/` + `/api` + `/ws`. Prefer **split** apps under `../backend` and `../frontend` for Coolify.

```bash
cp deploy/backend/.env.example backend/.env
sudo bash deploy/all-in-one/setup-vps.sh /var/www/garil-ai
```

Files: `Dockerfile`, `nixpacks.toml`, `nginx.conf`, `garil-ai.service`, `ecosystem.config.cjs`, `setup-vps.sh`.
