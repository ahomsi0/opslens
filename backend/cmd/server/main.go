package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahomsi0/opslens/backend/internal/ai"
	"github.com/ahomsi0/opslens/backend/internal/api"
	"github.com/ahomsi0/opslens/backend/internal/auth"
	"github.com/ahomsi0/opslens/backend/internal/crypto"
	"github.com/ahomsi0/opslens/backend/internal/db"
	"github.com/ahomsi0/opslens/backend/internal/metrics"
	"github.com/ahomsi0/opslens/backend/internal/migrations"
	"github.com/ahomsi0/opslens/backend/internal/providers"
	"github.com/ahomsi0/opslens/backend/internal/seed"
	"github.com/ahomsi0/opslens/backend/internal/uptime"
	"github.com/ahomsi0/opslens/backend/internal/ws"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	port := getenv("PORT", "8080")
	dbURL := getenv("DATABASE_URL", "postgres://opslens:opslens@localhost:5432/opslens?sslmode=disable")
	corsOrigin := getenv("CORS_ORIGIN", "http://localhost:3000")

	pool, err := connectWithRetry(ctx, dbURL, 30, time.Second)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool, migrations.FS); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := seed.IfEmpty(ctx, pool); err != nil {
		log.Fatalf("seed: %v", err)
	}

	sealer, err := crypto.New()
	if err != nil {
		log.Fatalf("crypto: %v", err)
	}

	// Live metric generator only runs against projects with live_metrics=true
	// (the demo projects). Real Vercel projects don't have synthetic metrics.
	liveProjects, err := db.ListProjectsWithLiveMetrics(ctx, pool)
	if err != nil {
		log.Fatalf("list live-metric projects: %v", err)
	}
	log.Printf("loaded %d projects with live metrics", len(liveProjects))

	hub := metrics.NewHub()
	gen := metrics.NewGenerator(hub)
	gen.Start(ctx, liveProjects)

	// Warm metric buffer briefly so /api/projects has data on first request.
	time.Sleep(1500 * time.Millisecond)

	// Background poller — re-syncs every connected provider every 30s.
	poller := providers.NewPoller(pool, sealer)
	go poller.Run(ctx)

	// Uptime prober — pings each project's domain on a 60s tick and records
	// the result. Read at request time via uptime.Get / uptime.GetMany.
	go uptime.NewProber(pool).Run(ctx)

	a := &api.API{Pool: pool, Hub: hub}
	wsh := &ws.Handler{Hub: hub, Pool: pool}
	connAPI := &api.ConnectionAPI{Pool: pool, Sealer: sealer, Syncer: poller}
	aiAPI := &api.AIAPI{Pool: pool, Limits: ai.DefaultLimits()}
	dockerAPI := &api.DockerAPI{Pool: pool, Sealer: sealer}
	authAPI := &api.AuthAPI{Pool: pool}

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   strings.Split(corsOrigin, ","),
		AllowedMethods:   []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true, // sessions are cookie-based and cross-origin
		MaxAge:           300,
	}))

	// Resolve session cookie → inject user into request context (no-op when absent).
	r.Use(auth.Resolve(pool))

	// Public routes — health, auth endpoints, docker heartbeat (its own auth).
	r.Get("/api/health", a.Health)
	r.Get("/api/auth/config", authAPI.Config)
	r.Get("/api/auth/me", authAPI.Me)
	r.Post("/api/auth/signup", authAPI.Signup)
	r.Post("/api/auth/login", authAPI.Login)
	r.Post("/api/auth/logout", authAPI.Logout)
	r.Get("/api/auth/github/start", authAPI.GithubStart)
	r.Get("/api/auth/github/callback", authAPI.GithubCallback)
	r.Post("/api/docker/heartbeat", dockerAPI.Heartbeat)

	// Authenticated routes — wrapped with RequireUser.
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireUser)

		r.Get("/api/projects", a.ListProjects)
		r.Get("/api/projects/{id}", a.GetProject)
		r.Get("/api/projects/{id}/deployments", a.ListDeployments)
		r.Get("/api/projects/{id}/logs", a.ListLogs)

		r.Get("/api/connections", connAPI.List)
		r.Post("/api/connections", connAPI.Create)
		r.Delete("/api/connections/{id}", connAPI.Delete)

		r.Get("/api/ai/config", aiAPI.Config)
		r.Get("/api/ai/quota", aiAPI.Quota)
		r.Post("/api/ai/chat", aiAPI.Chat)
	})

	// WebSocket needs auth too but the cookie is sent on the upgrade request
	// directly — no separate middleware wiring needed since Resolve runs first.
	r.Get("/ws/projects/{id}/metrics", wsh.MetricsWS)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutCancel()
	_ = srv.Shutdown(shutCtx)
}

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func connectWithRetry(ctx context.Context, url string, attempts int, every time.Duration) (*pgxpool.Pool, error) {
	var lastErr error
	for i := 0; i < attempts; i++ {
		pool, err := db.Connect(ctx, url)
		if err == nil {
			return pool, nil
		}
		lastErr = err
		log.Printf("db not ready (attempt %d/%d): %v", i+1, attempts, err)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(every):
		}
	}
	return nil, lastErr
}
