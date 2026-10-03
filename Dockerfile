# Build from repo root:
#   docker build -f deploy/frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_FEYNMAN_BACKEND=https://api.example.com \
#     -t garil-frontend .
#
# Coolify: Dockerfile path = deploy/frontend/Dockerfile (or repo-root copy).
# Runtime listens on $PORT (Coolify injects this).

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
ENV GARIL_STATIC_EXPORT=0

RUN npm run build \
	&& test -f .next/standalone/server.js

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV GARIL_STATIC_EXPORT=0

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 80
CMD ["node", "server.js"]
