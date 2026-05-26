# Opslens

AI-native deployment & infrastructure monitoring. Polished Next.js 15 frontend + a Go backend with live WebSocket metrics, backed by Postgres.

## Architecture

```
DeploymentMonitor/
├── docker-compose.yml      # Postgres 16
├── backend/                # Go (chi + pgx + gorilla/websocket)
│   ├── cmd/server/         # main.go
│   ├── internal/
│   │   ├── api/            # REST handlers
│   │   ├── db/             # pgx pool + queries
│   │   ├── metrics/        # synthetic per-project generator + fan-out hub
│   │   ├── migrations/     # embedded SQL migrations
│   │   ├── models/         # shared structs / API shape
│   │   ├── seed/           # idempotent seed on first boot
│   │   └── ws/             # WebSocket handler
│   └── Dockerfile
└── web/                    # Next.js 15 (App Router, RSC + client islands)
    ├── app/
    │   ├── (marketing)/    # /  landing
    │   ├── dashboard/      # /dashboard
    │   └── projects/[id]/  # detail / deployments / logs
    ├── components/
    │   ├── landing/        # hero, features, pricing, etc.
    │   ├── app/            # AppShell, Sidebar, TopBar, CommandPalette
    │   ├── projects/       # ProjectCard, StatusDot, header, tabs, overview
    │   ├── charts/         # LiveChart, Sparkline, ConnectionPill
    │   ├── logs/           # virtualized LogViewer
    │   ├── ai/             # docked AssistantPanel + FAB
    │   └── ui/             # shadcn-style primitives
    ├── lib/                # api, ws, types, format, utils
    └── hooks/              # useLiveMetrics
```

## Prerequisites

- Docker (for Postgres)
- Go 1.22+
- Node 18+ and pnpm (or npm)

## Run it locally

```bash
# 1. Start Postgres
docker compose up -d

# 2. Start the Go backend (applies migrations + seeds on first run)
cd backend
go run ./cmd/server
# → listening on :8080

# 3. In another terminal, start the frontend
cd web
pnpm install
pnpm dev
# → http://localhost:3000
```

Open <http://localhost:3000> for the landing page, <http://localhost:3000/dashboard> for the app.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | Liveness |
| GET | `/api/projects` | List with rolled-up uptime, p95 latency, sparkline |
| GET | `/api/projects/{id}` | Single project + recent deployments |
| GET | `/api/projects/{id}/deployments` | Paginated history |
| GET | `/api/projects/{id}/logs` | Filterable, cursor-paginated logs (`level`, `q`, `cursor`, `limit`) |
| WS  | `/ws/projects/{id}/metrics` | 1Hz `MetricFrame` stream with `replay` on connect |

## Environment

Backend reads:
- `DATABASE_URL` (default: `postgres://opslens:opslens@localhost:5432/opslens?sslmode=disable`)
- `PORT` (default: `8080`)
- `CORS_ORIGIN` (default: `http://localhost:3000`)

Frontend reads (set in `web/.env.local`):
- `NEXT_PUBLIC_API_URL` (default: `http://localhost:8080`)
- `NEXT_PUBLIC_WS_URL` (default: `ws://localhost:8080`)

## What's in this build

**Implemented end-to-end (real backend):**
- Landing page (hero with live mock dashboard, features, pricing, testimonials)
- Dashboard with project grid, live sparklines, fleet stats
- Project detail (Overview/Deployments tabs) with live CPU/memory/latency/network charts via WebSocket
- Virtualized logs viewer with level filter, search, follow-tail
- Command palette (`⌘K`)
- Polished AI assistant drawer with streaming canned responses (clearly labeled as preview)
- 6 seeded projects across Vercel/Render/Railway/Supabase/Neon/Docker, mix of healthy/degraded/down

**Intentionally not built (would need their own design pass):**
- Auth, teams, RBAC, billing
- Real AI integration (the panel is a UI preview)
- Real provider OAuth & webhooks (provider chips are visual only)
- Alerts pipeline (Slack/email/webhook)
- Settings page

These are the natural next sub-projects — see `docs/superpowers/specs/2026-05-26-opslens-design.md`.
