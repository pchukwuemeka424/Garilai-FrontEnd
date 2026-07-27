# Coolify / Docker — GARIL AI frontend (static Next export + nginx)
# Build arg: NEXT_PUBLIC_FEYNMAN_BACKEND=https://your-api.example.com

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

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
