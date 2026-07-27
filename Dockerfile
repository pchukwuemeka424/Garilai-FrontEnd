# Coolify / Docker — GARIL AI frontend (static Next export + nginx)
# Build arg: NEXT_PUBLIC_FEYNMAN_BACKEND=https://your-api.example.com
# Runtime: listens on $PORT (Coolify sets this; default 80)

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY lib ./lib
COPY public ./public
COPY styles ./styles
COPY next.config.ts postcss.config.mjs tsconfig.json next-env.d.ts ./

ARG NEXT_PUBLIC_FEYNMAN_BACKEND=
ENV NEXT_PUBLIC_FEYNMAN_BACKEND=$NEXT_PUBLIC_FEYNMAN_BACKEND
ENV NODE_ENV=production

RUN npm run build && test -f out/index.html

FROM nginx:1.27-alpine AS runtime

ENV PORT=80

COPY nginx.conf /etc/nginx/nginx-app.conf.template
COPY docker-entrypoint.sh /docker-entrypoint-app.sh
RUN chmod +x /docker-entrypoint-app.sh

COPY --from=build /app/out /usr/share/nginx/html

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint-app.sh"]
