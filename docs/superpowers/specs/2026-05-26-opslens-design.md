# Opslens — Design Spec

**Date:** 2026-05-26
**Scope:** Polished frontend (landing + dashboard + project detail + logs) + minimal Go backend with WebSocket live metrics + Postgres via Docker Compose.

## Out of scope (future specs)

Auth, teams/RBAC, billing, real AI assistant, real provider integrations (Vercel/Render/etc. APIs), alerts/notifications, settings page. The product surfaces these visually where appropriate but does not implement them.

## Architecture

Monorepo with two services:

```
DeploymentMonitor/
├── docker-compose.yml          # Postgres
├── README.md
├── web/                        # Next.js 15 App Router
└── backend/                    # Go service (chi + pgx + gorilla/websocket)
```

Frontend talks to backend over REST for hydration and WebSocket for live metrics. Backend reads/writes Postgres for persisted entities and emits synthetic time-series for live charts.

## Backend (Go)

- **Router:** `chi`
- **DB driver:** `pgx/v5` directly, no ORM
- **Migrations:** plain SQL files in `backend/migrations/`, applied on startup
- **WebSocket:** `gorilla/websocket`
- **Module layout:**
  ```
  backend/
  ├── cmd/server/main.go
  ├── internal/
  │   ├── api/           # HTTP handlers
  │   ├── ws/            # WebSocket hub + per-project broadcasters
  │   ├── db/            # pgx pool, query funcs
  │   ├── metrics/       # synthetic generator (goroutine per project)
  │   ├── seed/          # idempotent seed on boot
  │   └── models/        # shared structs (matching JSON shape)
  ├── migrations/
  ├── Dockerfile
  └── go.mod
  ```

### Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/api/projects` | List of projects with rolled-up status, uptime %, latest deployment, p95 latency, mini sparkline (last 60 points) |
| GET | `/api/projects/:id` | Single project + last 10 deployments + metric summary |
| GET | `/api/projects/:id/deployments` | Paginated deployment history (cursor) |
| GET | `/api/projects/:id/logs` | Paginated logs with `level`, `q`, `cursor` query params |
| GET | `/api/health` | `{ok: true}` |
| WS | `/ws/projects/:id/metrics` | Pushes one frame/sec: `{ts, cpu, mem, netIn, netOut, latency, rps, status}` |

### Synthetic metric generator

- One goroutine per known project, started on boot.
- Each project has a deterministic "personality" derived from its UUID: baseline CPU/RAM/latency, noise amplitude, spike probability.
- Generator pushes frames to a fan-out hub; WS handler subscribes per-connection.
- Buffers last 5 minutes in-memory for replay on connect.

### Seed data

On first boot (empty `projects` table), insert:
- **6 projects** across providers: `vercel`, `render`, `railway`, `supabase`, `neon`, `docker`
- Mix of statuses: 4 healthy, 1 degraded, 1 down
- ~30 deployments per project (mix of success/failed/rolled-back)
- ~2,000 log lines per project across levels (info/warn/error/debug)
- Regions spread across `iad1`, `sfo1`, `fra1`, `syd1`

## Frontend (Next.js 15)

### Stack

- Next.js 15 App Router, React 19, TypeScript strict
- Tailwind CSS v4 (CSS-first `@theme` config)
- shadcn/ui (installed via CLI, components live in `web/components/ui/`)
- Framer Motion for hero, page transitions, chart reveals, status dot pulses
- Recharts for time-series charts (lightweight, composable)
- `clsx` + `tailwind-merge` via shadcn's `cn()` helper
- `lucide-react` for icons

### Design tokens

```css
@theme {
  --color-bg: oklch(0.145 0.012 260);        /* #0A0B0F-ish */
  --color-surface: oklch(0.18 0.014 260);
  --color-surface-2: oklch(0.215 0.016 260);
  --color-border: oklch(0.28 0.018 260);
  --color-fg: oklch(0.97 0.005 260);
  --color-fg-muted: oklch(0.65 0.015 260);
  --color-accent: oklch(0.78 0.15 200);      /* electric cyan */
  --color-accent-2: oklch(0.72 0.18 295);    /* violet for AI surfaces */
  --color-success: oklch(0.75 0.17 155);
  --color-warning: oklch(0.82 0.16 80);
  --color-danger: oklch(0.68 0.22 25);
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

Dark-only. Glassmorphism limited to top nav and command palette (`backdrop-filter: blur(20px) saturate(160%)` with low-alpha surface).

### Folder layout

```
web/
├── app/
│   ├── (marketing)/page.tsx                # Landing
│   ├── dashboard/page.tsx
│   ├── projects/[id]/page.tsx              # Detail (Overview tab default)
│   ├── projects/[id]/deployments/page.tsx
│   ├── projects/[id]/logs/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                                 # shadcn primitives
│   ├── landing/                            # Hero, FeatureGrid, Pricing, Testimonials, CTA
│   ├── app/                                # AppShell, Sidebar, TopBar, CommandPalette
│   ├── projects/                           # ProjectCard, StatusDot, UptimeRing, EnvChip
│   ├── charts/                             # LiveLineChart, AreaChart, Sparkline, Heatmap
│   ├── logs/                               # LogViewer, LogRow, LevelFilter
│   └── ai/                                 # AssistantPanel, MessageBubble
├── lib/
│   ├── api.ts                              # typed fetch wrappers
│   ├── ws.ts                               # WebSocket client with reconnect
│   ├── types.ts                            # shared API types
│   ├── format.ts                           # number/time/uptime formatters
│   └── utils.ts                            # cn(), etc.
├── hooks/
│   ├── use-live-metrics.ts
│   └── use-command-palette.ts
├── public/
└── package.json
```

### Pages

**Landing (`/`)** — single-column scroll experience:
1. Top nav (glass, sticky)
2. Hero: animated headline, subhead, dual CTA, **live mock dashboard panel** floating right (real Framer Motion ticker, fake metric stream client-side — does not need backend)
3. Trust strip (fake provider logos)
4. Feature grid (3×2): real-time monitoring, AI insights, deployment history, alerts, multi-provider, beautiful charts
5. "How it works" three-step section
6. Pricing — 3 tiers (Hobby / Pro / Team) with highlighted middle tier
7. Testimonials — 3 quote cards
8. Final CTA + footer

**Dashboard (`/dashboard`)** — app shell with sidebar:
- Header: workspace name, "+ New project" button, search
- Stat row: total projects, healthy count, p95 latency, active alerts
- Project grid: 3-column responsive of `ProjectCard` (name, env chip, status dot with pulse, uptime %, last deploy, sparkline of last hour)
- Empty state when no projects

**Project detail (`/projects/[id]`)** — three tabs:
- **Overview** (default): hero row (name, status, env, region, latest commit), 4 live charts (CPU, Memory, Network in/out, Latency p50/p95/p99), request rate strip, recent deployments preview
- **Deployments** (`/deployments`): vertical timeline with rollback markers, status badges, duration, commit SHA + message, expandable to show build log preview
- **Logs** (`/logs`): full-height log viewer

**Logs viewer (`/projects/[id]/logs`)**:
- Sticky filter bar: level multi-select, free-text search, time range, "follow tail" toggle
- Virtualized list (`@tanstack/react-virtual`)
- Each row: timestamp (mono), level pill, source, message; click to expand stack trace
- Follow-tail mode appends new lines via WS subscription

### Shared UI

- **AppShell**: collapsible sidebar (nav: Dashboard, Projects, Logs, Alerts*, Settings*, AI*; *=visual-only stubs), top bar with breadcrumbs + workspace switcher
- **CommandPalette** (`⌘K`): fuzzy-search projects and actions, glass surface
- **AI Assistant docked panel**: floating button bottom-right opens a side drawer with a polished chat UI. Streams canned responses from a small client-side response bank keyed off question keywords ("why slow", "downtime", "deployment failed"). Clearly labeled as a UI preview.

## Data flow

1. RSC fetch on page load hits backend REST for initial hydration.
2. Project detail page opens one WS connection on mount; closes on unmount. Charts maintain a rolling 5-min buffer.
3. Logs page paginates via cursor on scroll; follow-tail subscribes to the same WS connection on a different message type.
4. No client-side data layer beyond hooks + React state. No Redux/Zustand.

## Error & loading states

- Loading: skeleton rows for tables, shimmer for charts, full-page skeleton for first paint on project detail.
- Errors: inline error card with retry button. WS disconnect shows a "Reconnecting…" pill in the corner; auto-reconnect with exponential backoff (1s → 2s → 4s → 8s, cap 8s).
- 404 for unknown project IDs.

## Local dev

```
docker compose up -d   # starts postgres
cd backend && go run ./cmd/server
cd web && pnpm dev
```

Backend reads `DATABASE_URL` from env, defaulting to the docker-compose Postgres. Frontend reads `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`, defaulting to `http://localhost:8080` and `ws://localhost:8080`.

## Acceptance criteria

- Landing page renders cleanly on mobile/tablet/desktop with smooth scroll animations.
- `docker compose up` + `go run` + `pnpm dev` produces a working app within ~30s of cold start.
- Dashboard shows 6 seeded projects with varied statuses.
- Project detail page shows charts that visibly update each second via real WebSocket frames from the Go backend.
- Logs page handles >2k entries without jank (virtualization required).
- All interactive elements have visible focus states and meet WCAG AA contrast on the dark theme.
- No console errors in dev, no TS errors, no ESLint errors on default Next config.
