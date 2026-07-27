# Garilai-FrontEnd

GARIL AI web UI — Next.js static export for the **Governed AI for Research, Instruction and Learning** platform.

This repository is the **frontend only**. The API, MongoDB, and agentic workflows live in a separate backend service. Point the UI at that API with `NEXT_PUBLIC_FEYNMAN_BACKEND`.

---

## Overview

**GARIL AI** helps students and lecturers with academic research:

- Research idea generation and evaluation
- Structured research outline creation (grounded in real papers)
- Full research paper drafting with citation verification
- Literature reviews, thesis proposals, and study comparisons
- Lecture planning and course preparation
- Saved sessions and research notebooks
- Admin / governance consoles for universities

Built for universities, colleges, polytechnics, and individual lecturers across Nigeria and beyond.

Product flows, agent pipeline, and route maps: **[PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md)**.

---

## Tech stack (this repo)

| Layer | Technology |
|-------|------------|
| UI | Next.js 16 (`output: "export"`), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Real-time client | WebSocket → backend `/ws` |
| Deploy | Docker + nginx (static `out/`) |

Backend (separate service): Fastify, MongoDB, OpenRouter, AlphaXiv / arXiv / Tavily.

---

## Prerequisites

- Node.js `>=20.19.0 <26` (see `.nvmrc`)
- A running GARIL AI **backend** (local or deployed)

---

## Environment

```bash
cp .env.example .env.local
```

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_FEYNMAN_BACKEND` | Public backend origin (no trailing slash), e.g. `http://127.0.0.1:3141` or `https://api.your.domain` |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional — research note cloud sync |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional — research note cloud sync |

In development, if `NEXT_PUBLIC_FEYNMAN_BACKEND` is unset, the client defaults to `http://<host>:3141`.

Do not commit secrets. `.env` / `.env.local` are gitignored.

---

## Install & run

```bash
npm install
npm run dev
```

- Frontend: http://localhost:3000  
- Backend (separate process): http://127.0.0.1:3141  

Long LLM requests call the API directly (not via Next rewrites) so they are not killed by the ~30s proxy timeout.

---

## Build

```bash
# Bake in the production API URL
NEXT_PUBLIC_FEYNMAN_BACKEND=https://api.your.domain npm run build
# Output → out/
```

Serve locally:

```bash
npm start   # serve out/ on :3000
```

---

## Project structure

```
.
├── app/                  # Next.js App Router pages
│   ├── research/         # Ideas, outline, paper, saved, note
│   ├── dashboard/        # Lecturer dashboard
│   ├── student/          # Student surfaces
│   ├── lesson-planner/   # Course planning
│   ├── admin/            # University admin
│   └── super-admin/      # Platform super-admin
├── components/           # UI (research, auth, admin, lesson planner, …)
├── lib/                  # API clients, routes, citations, branding
├── hooks/                # Auth, WebSocket, admin helpers
├── public/               # Static assets / brand
├── styles/               # Shared CSS
├── Dockerfile            # nginx image for Coolify / VPS
├── nginx.conf            # Container nginx
├── deploy/               # Host nginx sample
├── PROJECT_WORKFLOW.md   # Journeys, WS protocol, frontend map
└── README.md
```

---

## Deploy (Coolify / VPS)

| Setting | Value |
|---------|--------|
| Dockerfile | repo root `Dockerfile` |
| Port | `80` |
| Health check | `/healthz` |
| Build arg / env | `NEXT_PUBLIC_FEYNMAN_BACKEND` = public backend URL |

```bash
docker build \
  --build-arg NEXT_PUBLIC_FEYNMAN_BACKEND=https://api.example.com \
  -t garilai-frontend .

docker run --rm -p 8080:80 garilai-frontend
```

More detail: [deploy/README.md](deploy/README.md).

---

## Related docs

- [PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md) — user journeys, chat/WebSocket client flow, key paths
- [deploy/README.md](deploy/README.md) — Coolify, Docker, host nginx
- [.env.example](.env.example) — public env template
