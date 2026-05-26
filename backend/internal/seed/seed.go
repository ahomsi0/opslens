package seed

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type projectSeed struct {
	Name        string
	Slug        string
	Provider    string
	Environment string
	Region      string
	RepoURL     string
	Domain      string
	Status      string
}

var projects = []projectSeed{
	{"api-gateway", "api-gateway", "vercel", "production", "iad1", "github.com/opslens/api-gateway", "api.opslens.io", "healthy"},
	{"web-frontend", "web-frontend", "vercel", "production", "sfo1", "github.com/opslens/web", "opslens.io", "healthy"},
	{"billing-service", "billing-service", "render", "production", "iad1", "github.com/opslens/billing", "billing.opslens.io", "degraded"},
	{"worker-queue", "worker-queue", "railway", "production", "fra1", "github.com/opslens/worker", "worker.internal", "healthy"},
	{"auth-db", "auth-db", "neon", "production", "iad1", "github.com/opslens/auth-db", "db.opslens.io", "healthy"},
	{"ml-inference", "ml-inference", "docker", "staging", "syd1", "github.com/opslens/ml-inference", "ml-staging.opslens.io", "down"},
}

var commitMessages = []string{
	"feat: add request retry middleware",
	"fix: handle nil pointer in webhook parser",
	"chore: bump dependencies",
	"refactor: extract metrics emitter into its own package",
	"perf: cache provider responses for 30s",
	"feat: rotate API keys via background job",
	"fix: race condition in queue consumer",
	"docs: update deployment runbook",
	"test: cover edge cases in billing proration",
	"feat: introduce regional read replicas",
	"fix: correctly forward x-request-id",
	"refactor: simplify auth token validation",
	"feat: add Slack alert channel",
	"perf: lazy-load deployment timeline",
	"fix: SSE keepalive timing",
}

var authors = []string{"alex.chen", "priya.s", "jordan.kim", "marc.b", "sofia.r", "yuki.t"}
var branches = []string{"main", "main", "main", "main", "release/v2", "staging"}
var depStatuses = []string{"success", "success", "success", "success", "success", "success", "failed", "rolled-back"}

var logSources = []string{"api", "worker", "scheduler", "db", "auth", "router"}
var logTemplates = map[string][]string{
	"info": {
		"request handled GET /v1/projects status=200 dur=%dms",
		"job sync_metrics completed items=%d",
		"connection pool acquired conn=%d",
		"cache hit key=user:%d ttl=%ds",
		"healthcheck ok upstream=postgres",
		"deploy build started commit=%s",
		"warmup complete in %dms",
		"flushed metrics buffer count=%d",
	},
	"warn": {
		"slow query detected query_ms=%d table=deployments",
		"retrying upstream call attempt=%d",
		"queue backlog growing depth=%d",
		"deprecated endpoint hit by client=mobile-v3",
		"rate limit threshold reached ip=10.4.%d.%d",
	},
	"error": {
		"connection refused upstream=billing-service",
		"unhandled exception in handler=ProcessWebhook",
		"timeout waiting for db pool conn after %dms",
		"failed to publish event topic=deployments.created",
		"5xx returned from provider provider=vercel code=502",
	},
	"debug": {
		"resolved trace id=trace_%s",
		"emitted metric name=cpu.pct value=%d",
		"config reload signal received",
		"buffered span batch size=%d",
		"span finalized name=%s dur=%dms",
	},
}

func IfEmpty(ctx context.Context, pool *pgxpool.Pool) error {
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM projects`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	return run(ctx, pool)
}

func run(ctx context.Context, pool *pgxpool.Pool) error {
	rng := rand.New(rand.NewSource(42))
	now := time.Now().UTC()

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, p := range projects {
		pid := uuid.New()
		_, err := tx.Exec(ctx, `
			INSERT INTO projects (id, name, slug, provider, environment, region, repo_url, domain, status, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		`, pid, p.Name, p.Slug, p.Provider, p.Environment, p.Region, p.RepoURL, p.Domain, p.Status,
			now.Add(-time.Duration(30+rng.Intn(200))*24*time.Hour))
		if err != nil {
			return fmt.Errorf("insert project %s: %w", p.Slug, err)
		}

		// 30 deployments per project
		t := now.Add(-30 * 24 * time.Hour)
		for i := 0; i < 30; i++ {
			t = t.Add(time.Duration(rng.Intn(24*60)+30) * time.Minute)
			status := depStatuses[rng.Intn(len(depStatuses))]
			if i == 29 && p.Status == "down" {
				status = "failed"
			}
			_, err := tx.Exec(ctx, `
				INSERT INTO deployments (id, project_id, status, commit_sha, commit_msg, author, branch, duration_ms, created_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			`,
				uuid.New(), pid, status,
				randSHA(rng),
				commitMessages[rng.Intn(len(commitMessages))],
				authors[rng.Intn(len(authors))],
				branches[rng.Intn(len(branches))],
				20_000+rng.Intn(180_000),
				t,
			)
			if err != nil {
				return fmt.Errorf("insert deployment: %w", err)
			}
		}

		// ~600 log lines per project
		logCount := 600
		baseTime := now.Add(-6 * time.Hour)
		levels := []string{"info", "info", "info", "info", "debug", "warn", "error"}

		logRows := make([][]any, 0, logCount)
		for i := 0; i < logCount; i++ {
			level := levels[rng.Intn(len(levels))]
			if p.Status == "down" && i > logCount-50 {
				level = "error"
			}
			tmpls := logTemplates[level]
			tmpl := tmpls[rng.Intn(len(tmpls))]
			msg := fillTemplate(tmpl, rng)
			ts := baseTime.Add(time.Duration(i)*30*time.Second).Add(time.Duration(rng.Intn(10000)) * time.Millisecond)
			logRows = append(logRows, []any{pid, level, logSources[rng.Intn(len(logSources))], msg, ts})
		}

		_, err = tx.CopyFrom(ctx,
			pgx.Identifier{"logs"},
			[]string{"project_id", "level", "source", "message", "created_at"},
			pgx.CopyFromRows(logRows),
		)
		if err != nil {
			return fmt.Errorf("copy logs: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func randSHA(rng *rand.Rand) string {
	const hex = "0123456789abcdef"
	b := make([]byte, 7)
	for i := range b {
		b[i] = hex[rng.Intn(16)]
	}
	return string(b)
}

func fillTemplate(tmpl string, rng *rand.Rand) string {
	var out []byte
	for i := 0; i < len(tmpl); i++ {
		if tmpl[i] == '%' && i+1 < len(tmpl) {
			switch tmpl[i+1] {
			case 'd':
				out = append(out, []byte(fmt.Sprintf("%d", rng.Intn(9000)+100))...)
				i++
				continue
			case 's':
				out = append(out, []byte(randSHA(rng))...)
				i++
				continue
			case '%':
				out = append(out, '%')
				i++
				continue
			}
		}
		out = append(out, tmpl[i])
	}
	return string(out)
}
