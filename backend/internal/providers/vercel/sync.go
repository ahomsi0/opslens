// Package vercel sync: translate Vercel API responses into our internal
// projects/deployments tables. Upserts by (connection_id, external_id) so
// re-runs are idempotent.
package vercel

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Sync pulls all projects (and a slice of recent deployments per project)
// for the connection and upserts them. Returns the number of projects synced.
func Sync(ctx context.Context, pool *pgxpool.Pool, connectionID uuid.UUID, token string) (int, error) {
	c := NewClient(token)

	projects, err := c.ListProjects(ctx)
	if err != nil {
		return 0, fmt.Errorf("list projects: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	for _, p := range projects {
		// Derive fields we care about. Vercel doesn't expose a 'region' the same
		// way other providers do, so we surface the deployment region if available
		// and otherwise mark it 'global'.
		region := "global"
		domain := primaryDomain(p)
		env := "production"
		status := mapStatus(p)
		repoURL := ""
		if p.Link != nil {
			repoURL = fmt.Sprintf("%s.com/%s", p.Link.Type, p.Link.Repo)
		}
		createdAt := time.UnixMilli(p.CreatedAt)

		var projectID uuid.UUID
		err := tx.QueryRow(ctx, `
			INSERT INTO projects (id, name, slug, provider, environment, region,
			                     repo_url, domain, status, created_at,
			                     source, connection_id, external_id, live_metrics)
			VALUES ($1,$2,$3,'vercel',$4,$5,$6,$7,$8,$9,'vercel',$10,$11,FALSE)
			ON CONFLICT (connection_id, external_id) DO UPDATE SET
			    name        = EXCLUDED.name,
			    slug        = EXCLUDED.slug,
			    environment = EXCLUDED.environment,
			    region      = EXCLUDED.region,
			    repo_url    = EXCLUDED.repo_url,
			    domain      = EXCLUDED.domain,
			    status      = EXCLUDED.status
			RETURNING id
		`,
			uuid.New(), p.Name, slugify(p.Name),
			env, region, repoURL, domain, status, createdAt,
			connectionID, p.ID,
		).Scan(&projectID)
		if err != nil {
			return 0, fmt.Errorf("upsert project %s: %w", p.Name, err)
		}

		// Recent deployments per project.
		deps, err := c.ListDeployments(ctx, p.ID, 20)
		if err != nil {
			// Soft-fail per-project; one bad project shouldn't kill the sync.
			continue
		}
		for _, d := range deps {
			created := time.UnixMilli(d.Created)
			durMs := 0
			if d.ReadyAt > 0 && d.BuildingAt > 0 {
				durMs = int(d.ReadyAt - d.BuildingAt)
			}
			sha := d.Meta.GithubCommitSha
			if sha == "" {
				sha = d.UID
			}
			msg := d.Meta.GithubCommitMessage
			if msg == "" {
				msg = "deployment"
			}
			author := d.Meta.GithubCommitAuthor
			if author == "" {
				author = d.Creator.Username
			}
			branch := d.Meta.GithubCommitRef
			if branch == "" {
				branch = "main"
			}

			_, err := tx.Exec(ctx, `
				INSERT INTO deployments (id, project_id, status, commit_sha, commit_msg,
				                        author, branch, duration_ms, created_at, external_id)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
				ON CONFLICT (project_id, external_id) DO UPDATE SET
				    status      = EXCLUDED.status,
				    duration_ms = EXCLUDED.duration_ms
			`,
				uuid.New(), projectID, mapDeployState(d.State),
				sha, msg, author, branch, durMs, created, d.UID,
			)
			if err != nil {
				return 0, fmt.Errorf("upsert deployment %s: %w", d.UID, err)
			}
		}
	}

	// Stamp the sync time on the connection.
	if _, err := tx.Exec(ctx, `
		UPDATE provider_connections
		SET last_synced_at = now(), last_error = NULL
		WHERE id = $1
	`, connectionID); err != nil {
		return 0, err
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return len(projects), nil
}

func primaryDomain(p Project) string {
	if len(p.Alias) > 0 {
		return p.Alias[0].Domain
	}
	if d := p.LatestProductionDeployment(); d != nil && d.URL != "" {
		return d.URL
	}
	return p.Name + ".vercel.app"
}

func mapStatus(p Project) string {
	d := p.LatestProductionDeployment()
	if d == nil {
		return "healthy"
	}
	switch d.ReadyState {
	case "READY":
		return "healthy"
	case "ERROR":
		return "down"
	case "BUILDING", "QUEUED":
		return "degraded"
	default:
		return "healthy"
	}
}

func mapDeployState(s string) string {
	switch s {
	case "READY":
		return "success"
	case "ERROR":
		return "failed"
	case "CANCELED":
		return "canceled"
	case "BUILDING", "QUEUED":
		return "building"
	default:
		return "success"
	}
}

// slugify converts a project name into a URL-safe slug. Vercel names are
// already URL-safe so this is mostly a defensive lowercase + strip.
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
		return "project"
	}
	return string(out)
}
