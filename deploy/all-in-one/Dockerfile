# All-in-one (single container: API + static UI)
# Prefer split services in ../backend and ../frontend for Coolify.
#   docker build -f deploy/all-in-one/Dockerfile -t garil-ai .

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend

COPY . .
ENV NODE_ENV=production
RUN npm run build \
	&& npx tsc -p backend/tsconfig.json \
	&& test -f out/index.html \
	&& test -f backend/dist/index.js

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3141

COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./backend/
RUN npm ci --omit=dev --prefix backend

COPY --from=build /app/out ./out
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prompts ./backend/prompts

EXPOSE 3141
CMD ["node", "backend/dist/index.js"]
