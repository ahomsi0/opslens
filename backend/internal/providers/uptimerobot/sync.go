// UptimeRobot sync — UptimeRobot is a monitoring service, not an app
// platform, so there are no deployments to pull. Each monitor becomes one
// row in the projects table, with status mapped from UptimeRobot's
// numeric state and domain pulled from the monitor URL.
package uptimerobot

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Sync(ctx context.Context, pool *pgxpool.Pool, connectionID uuid.UUID, token string) (int, error) {
	c := NewClient(token)

	monitors, err := c.ListMonitors(ctx)
	if err != nil {
		return 0, fmt.Errorf("list monitors: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	for _, m := range monitors {
		domain := hostOnly(m.URL)
		if domain == "" {
			domain = m.URL
		}
		createdAt := time.Unix(m.CreateDatetime, 0).UTC()
		if m.CreateDatetime == 0 {
			createdAt = time.Now().UTC()
		}
		name := strings.TrimSpace(m.FriendlyName)
		if name == "" {
			name = domain
		}

		_, err := tx.Exec(ctx, `
			INSERT INTO projects (id, name, slug, provider, environment, region,
			                     repo_url, domain, status, created_at,
			                     source, connection_id, external_id, live_metrics)
			VALUES ($1,$2,$3,'uptimerobot','production','global','',$4,$5,$6,'uptimerobot',$7,$8,FALSE)
			ON CONFLICT (connection_id, external_id) WHERE connection_id IS NOT NULL
			DO UPDATE SET
			    name        = EXCLUDED.name,
			    slug        = EXCLUDED.slug,
			    domain      = EXCLUDED.domain,
			    status      = EXCLUDED.status
		`,
			uuid.New(), name, slugify(name),
			domain, mapStatus(m.Status), createdAt,
			connectionID, strconv.Itoa(m.ID),
		)
		if err != nil {
			return 0, fmt.Errorf("upsert monitor %s: %w", name, err)
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
	return len(monitors), nil
}

// mapStatus collapses UptimeRobot's 5 numeric states into our 3-state model.
// Paused monitors are "degraded" (yellow) rather than "down" — the user
// intentionally turned them off, they're not failing.
func mapStatus(s int) string {
	switch s {
	case MonitorUp:
		return "healthy"
	case MonitorSeemDown, MonitorDown:
		return "down"
	case MonitorPaused, MonitorNotYet:
		return "degraded"
	default:
		return "healthy"
	}
}

// hostOnly strips scheme + path so the projects.domain column matches what
// other providers store (e.g. "example.com", not "https://example.com/foo").
func hostOnly(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	// url.Parse needs a scheme to populate Host. If the user entered a bare
	// host (e.g. "example.com"), Parse puts it in Path — handle both.
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return strings.TrimPrefix(strings.TrimPrefix(raw, "https://"), "http://")
	}
	return u.Host
}

func slugify(name string) string {
	out := make([]rune, 0, len(name))
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-', r == '_':
			out = append(out, r)
		case r >= 'A' && r <= 'Z':
			out = append(out, r+32)
		case r == ' ', r == '.':
			out = append(out, '-')
		}
	}
	if len(out) == 0 {
		return "monitor"
	}
	return string(out)
}
