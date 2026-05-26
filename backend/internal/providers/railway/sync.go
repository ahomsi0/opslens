// Railway sync — one Railway *service* becomes one of our projects. Each
// service can have multiple deployments (built-from-git or manual). Status
// is derived from the latest deployment's state.
package railway

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

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

	synced := 0
	for _, p := range projects {
		for _, sEdge := range p.Services.Edges {
			svc := sEdge.Node

			// Latest deployment's status sets our project status.
			status := "healthy"
			domain := ""
			if len(svc.Deployments.Edges) > 0 {
				latest := svc.Deployments.Edges[0].Node
				status = mapServiceStatus(latest.Status)
				if latest.StaticUrl != "" {
					domain = strings.TrimPrefix(latest.StaticUrl, "https://")
				}
			}
			if domain == "" {
				domain = fmt.Sprintf("%s.up.railway.app", strings.ToLower(svc.Name))
			}

			// Combine Railway's project name with the service for clarity.
			displayName := svc.Name
			if p.Name != "" && p.Name != svc.Name {
				displayName = fmt.Sprintf("%s / %s", p.Name, svc.Name)
			}

			var projectID uuid.UUID
			err := tx.QueryRow(ctx, `
				INSERT INTO projects (id, name, slug, provider, environment, region,
				                     repo_url, domain, status, created_at,
				                     source, connection_id, external_id, live_metrics)
				VALUES ($1,$2,$3,'railway','production','global','',$4,$5,$6,'railway',$7,$8,FALSE)
				ON CONFLICT (connection_id, external_id) WHERE connection_id IS NOT NULL
				DO UPDATE SET
				    name   = EXCLUDED.name,
				    slug   = EXCLUDED.slug,
				    domain = EXCLUDED.domain,
				    status = EXCLUDED.status
				RETURNING id
			`,
				uuid.New(), displayName, slugify(displayName),
				domain, status, parseTime(svc.CreatedAt),
				connectionID, svc.ID,
			).Scan(&projectID)
			if err != nil {
				return 0, fmt.Errorf("upsert service %s: %w", svc.Name, err)
			}

			for _, dEdge := range svc.Deployments.Edges {
				d := dEdge.Node
				sha := d.Meta.CommitHash
				if sha == "" {
					sha = d.ID
				}
				msg := d.Meta.CommitMessage
				if msg == "" {
					msg = "deployment"
				}
				author := d.Meta.CommitAuthor
				if author == "" {
					author = "railway"
				}
				branch := d.Meta.Branch
				if branch == "" {
					branch = "main"
				}

				_, err := tx.Exec(ctx, `
					INSERT INTO deployments (id, project_id, status, commit_sha, commit_msg,
					                        author, branch, duration_ms, created_at, external_id)
					VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
					ON CONFLICT (project_id, external_id) WHERE external_id IS NOT NULL
					DO UPDATE SET status = EXCLUDED.status
				`,
					uuid.New(), projectID, mapDeployState(d.Status),
					sha, msg, author, branch, 0, parseTime(d.CreatedAt), d.ID,
				)
				if err != nil {
					return 0, fmt.Errorf("upsert deploy %s: %w", d.ID, err)
				}
			}

			synced++
		}
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

// Railway's deployment statuses.
func mapServiceStatus(s string) string {
	switch s {
	case "SUCCESS":
		return "healthy"
	case "FAILED", "CRASHED":
		return "down"
	case "BUILDING", "DEPLOYING", "WAITING", "QUEUED", "INITIALIZING":
		return "degraded"
	case "REMOVED", "REMOVING":
		return "degraded"
	default:
		return "healthy"
	}
}

func mapDeployState(s string) string {
	switch s {
	case "SUCCESS":
		return "success"
	case "FAILED", "CRASHED":
		return "failed"
	case "BUILDING", "DEPLOYING", "WAITING", "QUEUED", "INITIALIZING":
		return "building"
	case "REMOVED":
		return "canceled"
	default:
		return "success"
	}
}

func parseTime(s string) time.Time {
	if s == "" {
		return time.Now().UTC()
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	return time.Now().UTC()
}

func slugify(name string) string {
	out := make([]rune, 0, len(name))
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-', r == '_':
			out = append(out, r)
		case r >= 'A' && r <= 'Z':
			out = append(out, r+32)
		case r == ' ', r == '/':
			out = append(out, '-')
		}
	}
	if len(out) == 0 {
		return "service"
	}
	return string(out)
}
