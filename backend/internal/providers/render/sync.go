// Package render sync — pulls services + recent deploys from Render and
// upserts them into the same projects/deployments tables the rest of
// Opslens reads from. Mirrors the Vercel sync pattern.
package render

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Sync pulls services and recent deploys for the given Render connection.
// Returns the number of services synced.
func Sync(ctx context.Context, pool *pgxpool.Pool, connectionID uuid.UUID, token string) (int, error) {
	c := NewClient(token)

	services, err := c.ListServices(ctx, 100)
	if err != nil {
		return 0, fmt.Errorf("list services: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	synced := 0
	for _, s := range services {
		// Skip non-runnable types (postgres, redis) — Opslens monitors deployed
		// app surfaces, not managed datastores (yet).
		if s.Type == "postgres" || s.Type == "redis" {
			continue
		}

		region := s.ServiceDetails.Region
		if region == "" {
			region = "global"
		}
		env := "production" // Render doesn't expose env separately on the service object
		domain := s.ServiceDetails.URL
		if domain == "" {
			domain = s.Name + ".onrender.com"
		} else {
			domain = strings.TrimPrefix(domain, "https://")
		}
		repoURL := strings.TrimPrefix(s.Repo, "https://")
		createdAt := parseTime(s.CreatedAt)
		status := mapServiceStatus(s)

		var projectID uuid.UUID
		err := tx.QueryRow(ctx, `
			INSERT INTO projects (id, name, slug, provider, environment, region,
			                     repo_url, domain, status, created_at,
			                     source, connection_id, external_id, live_metrics)
			VALUES ($1,$2,$3,'render',$4,$5,$6,$7,$8,$9,'render',$10,$11,FALSE)
			ON CONFLICT (connection_id, external_id) WHERE connection_id IS NOT NULL
			DO UPDATE SET
			    name        = EXCLUDED.name,
			    slug        = EXCLUDED.slug,
			    environment = EXCLUDED.environment,
			    region      = EXCLUDED.region,
			    repo_url    = EXCLUDED.repo_url,
			    domain      = EXCLUDED.domain,
			    status      = EXCLUDED.status
			RETURNING id
		`,
			uuid.New(), s.Name, slugify(s.Name),
			env, region, repoURL, domain, status, createdAt,
			connectionID, s.ID,
		).Scan(&projectID)
		if err != nil {
			return 0, fmt.Errorf("upsert service %s: %w", s.Name, err)
		}

		// Recent deploys
		deps, err := c.ListDeploys(ctx, s.ID, 20)
		if err != nil {
			// Soft-fail per-service so one broken one doesn't kill the sync.
			continue
		}
		for _, d := range deps {
			sha := ""
			msg := "deployment"
			if d.Commit != nil {
				sha = d.Commit.ID
				if d.Commit.Message != "" {
					msg = d.Commit.Message
				}
			}
			if sha == "" {
				sha = d.ID
			}
			created := parseTime(d.CreatedAt)
			finished := parseTime(d.FinishedAt)
			durMs := 0
			if !finished.IsZero() && !created.IsZero() {
				durMs = int(finished.Sub(created).Milliseconds())
			}

			_, err := tx.Exec(ctx, `
				INSERT INTO deployments (id, project_id, status, commit_sha, commit_msg,
				                        author, branch, duration_ms, created_at, external_id)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
				ON CONFLICT (project_id, external_id) WHERE external_id IS NOT NULL
				DO UPDATE SET
				    status      = EXCLUDED.status,
				    duration_ms = EXCLUDED.duration_ms
			`,
				uuid.New(), projectID, mapDeployState(d.Status),
				sha, msg, "render", "main", durMs, created, d.ID,
			)
			if err != nil {
				return 0, fmt.Errorf("upsert deploy %s: %w", d.ID, err)
			}
		}

		synced++
	}

	if _, err := tx.Exec(ctx, `
		UPDATE provider_connections SET last_synced_at = now(), last_error = NULL
		WHERE id = $1
	`, connectionID); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return synced, nil
}

func mapServiceStatus(s Service) string {
	if s.Suspended == "suspended" {
		return "down"
	}
	return "healthy"
}

func mapDeployState(s string) string {
	switch s {
	case "live":
		return "success"
	case "build_failed", "update_failed":
		return "failed"
	case "canceled", "deactivated":
		return "canceled"
	case "build_in_progress", "update_in_progress", "created":
		return "building"
	default:
		return "success"
	}
}

func parseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	return time.Time{}
}

func slugify(name string) string {
	out := make([]rune, 0, len(name))
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z':
			out = append(out, r)
		case r >= 'A' && r <= 'Z':
			out = append(out, r+32)
		case r >= '0' && r <= '9':
			out = append(out, r)
		case r == '-' || r == '_':
			out = append(out, r)
		case r == ' ':
			out = append(out, '-')
		}
	}
	if len(out) == 0 {
		return "service"
	}
	return string(out)
}
