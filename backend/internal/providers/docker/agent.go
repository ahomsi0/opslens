// Package docker is agent-based. Docker isn't a SaaS we can pull from —
// the user installs a small shell loop on their host that POSTs container
// state to /api/docker/heartbeat. Each heartbeat upserts the running
// containers as projects under the connection.
package docker

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NewToken generates the heartbeat secret the agent sends on every POST.
// 32 random bytes hex-encoded → 64 chars, prefixed with 'dkr_' for easy
// recognition in logs.
func NewToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return "dkr_" + hex.EncodeToString(b)
}

// Container is the per-container payload the agent sends. Mirrors the
// `docker ps` output our recommended one-liner produces.
type Container struct {
	ID     string `json:"id"`     // short or long container id
	Name   string `json:"name"`   // container name
	Image  string `json:"image"`  // image:tag
	Status string `json:"status"` // 'running' | 'restarting' | 'exited' | ...
	State  string `json:"state"`  // 'Up 2 hours' style human string
}

type Heartbeat struct {
	HostName   string      `json:"hostName"`   // hostname of the Docker host
	AgentVer   string      `json:"agentVer"`   // version string from the agent
	Containers []Container `json:"containers"` // current running set
}

// Apply takes a heartbeat from a verified connection and upserts the
// running containers as projects. Containers no longer reported are
// marked 'down' (their last heartbeat is preserved by created_at).
func Apply(ctx context.Context, pool *pgxpool.Pool, conn ConnectionInfo, hb Heartbeat) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	seen := map[string]bool{}
	for _, c := range hb.Containers {
		seen[c.ID] = true
		status := mapStatus(c.Status)
		// Build a display name combining host + container.
		display := c.Name
		if hb.HostName != "" {
			display = fmt.Sprintf("%s · %s", hb.HostName, c.Name)
		}
		domain := c.Image // image:tag is the closest "address" docker has
		_, err := tx.Exec(ctx, `
			INSERT INTO projects (id, name, slug, provider, environment, region,
			                     repo_url, domain, status, created_at,
			                     source, connection_id, external_id, live_metrics)
			VALUES ($1,$2,$3,'docker','production',$4,'',$5,$6,now(),'docker',$7,$8,FALSE)
			ON CONFLICT (connection_id, external_id) WHERE connection_id IS NOT NULL
			DO UPDATE SET
			    name   = EXCLUDED.name,
			    slug   = EXCLUDED.slug,
			    region = EXCLUDED.region,
			    domain = EXCLUDED.domain,
			    status = EXCLUDED.status
		`,
			uuid.New(), display, slugify(c.Name),
			hb.HostName, domain, status,
			conn.ID, c.ID,
		)
		if err != nil {
			return fmt.Errorf("upsert container %s: %w", c.Name, err)
		}
	}

	// Mark anything previously seen on this connection but absent from the
	// heartbeat as 'down' (stopped/removed since last beat).
	rows, err := tx.Query(ctx, `
		SELECT external_id FROM projects WHERE connection_id = $1 AND source = 'docker'
	`, conn.ID)
	if err != nil {
		return err
	}
	missing := []string{}
	for rows.Next() {
		var ext string
		if err := rows.Scan(&ext); err != nil {
			rows.Close()
			return err
		}
		if !seen[ext] {
			missing = append(missing, ext)
		}
	}
	rows.Close()
	if len(missing) > 0 {
		if _, err := tx.Exec(ctx, `
			UPDATE projects SET status = 'down'
			WHERE connection_id = $1 AND external_id = ANY($2)
		`, conn.ID, missing); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE provider_connections SET last_synced_at = now(), last_error = NULL
		WHERE id = $1
	`, conn.ID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func mapStatus(s string) string {
	switch s {
	case "running":
		return "healthy"
	case "restarting", "paused":
		return "degraded"
	case "exited", "dead", "removing":
		return "down"
	default:
		return "healthy"
	}
}

// ConnectionInfo is the slice of provider_connections we need to apply a
// heartbeat. Looked up by the agent's bearer token.
type ConnectionInfo struct {
	ID uuid.UUID
}

// FindByToken locates a docker connection given the agent's plain-text
// heartbeat token. We compare against the encrypted column by decrypting
// each docker connection (there will typically be very few, so the linear
// scan is fine).
func FindByToken(ctx context.Context, pool *pgxpool.Pool, decrypt func([]byte) (string, error), token string) (*ConnectionInfo, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, encrypted_token FROM provider_connections WHERE provider = 'docker'
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var enc []byte
		if err := rows.Scan(&id, &enc); err != nil {
			return nil, err
		}
		plain, err := decrypt(enc)
		if err != nil {
			continue
		}
		if subtleEqual(plain, token) {
			return &ConnectionInfo{ID: id}, nil
		}
	}
	if err := rows.Err(); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	return nil, errors.New("docker: unknown agent token")
}

// subtleEqual is a constant-time string compare to avoid timing attacks
// on the agent token. We don't import crypto/subtle just for this — but
// for completeness, here's the equivalent.
func subtleEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var v byte
	for i := 0; i < len(a); i++ {
		v |= a[i] ^ b[i]
	}
	return v == 0
}

func slugify(name string) string {
	out := make([]rune, 0, len(name))
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-', r == '_':
			out = append(out, r)
		case r >= 'A' && r <= 'Z':
			out = append(out, r+32)
		}
	}
	if len(out) == 0 {
		return "container"
	}
	return string(out)
}

// Heartbeat helper: enforce a max age on a connection's last_synced_at so
// stale Docker hosts get marked as down without waiting for the agent.
func MarkStaleConnections(ctx context.Context, pool *pgxpool.Pool, maxAge time.Duration) error {
	_, err := pool.Exec(ctx, `
		UPDATE projects SET status = 'down'
		WHERE source = 'docker'
		  AND connection_id IN (
		      SELECT id FROM provider_connections
		      WHERE provider = 'docker'
		        AND last_synced_at < now() - $1::interval
		  )
		  AND status != 'down'
	`, fmt.Sprintf("%d seconds", int(maxAge.Seconds())))
	return err
}
