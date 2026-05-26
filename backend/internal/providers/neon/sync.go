// Neon sync — Neon doesn't have "deployments" the way an app platform does
// (it's a managed Postgres), so we sync projects only. Each project lands
// in our projects table; the deployments tab will be empty for Neon rows,
// which is accurate.
package neon

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

	for _, p := range projects {
		region := normalizeRegion(p.RegionID)
		createdAt := parseTime(p.CreatedAt)
		domain := fmt.Sprintf("%s.neon.tech", p.ID)

		_, err := tx.Exec(ctx, `
			INSERT INTO projects (id, name, slug, provider, environment, region,
			                     repo_url, domain, status, created_at,
			                     source, connection_id, external_id, live_metrics)
			VALUES ($1,$2,$3,'neon','production',$4,'',$5,'healthy',$6,'neon',$7,$8,FALSE)
			ON CONFLICT (connection_id, external_id) WHERE connection_id IS NOT NULL
			DO UPDATE SET
			    name        = EXCLUDED.name,
			    slug        = EXCLUDED.slug,
			    region      = EXCLUDED.region,
			    domain      = EXCLUDED.domain
		`,
			uuid.New(), p.Name, slugify(p.Name),
			region, domain, createdAt,
			connectionID, p.ID,
		)
		if err != nil {
			return 0, fmt.Errorf("upsert project %s: %w", p.Name, err)
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
	return len(projects), nil
}

func normalizeRegion(s string) string {
	// Neon returns "aws-us-east-1" — strip the platform prefix for cleaner display.
	if strings.HasPrefix(s, "aws-") {
		return strings.TrimPrefix(s, "aws-")
	}
	if strings.HasPrefix(s, "azure-") {
		return strings.TrimPrefix(s, "azure-")
	}
	if s == "" {
		return "global"
	}
	return s
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
		case r == ' ':
			out = append(out, '-')
		}
	}
	if len(out) == 0 {
		return "project"
	}
	return string(out)
}
