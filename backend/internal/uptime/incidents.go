// Incident state-machine. After every probe, evaluate the recent history:
//
//   - 3 consecutive failures with no open incident → open one
//   - 3 consecutive successes with an open incident → close it
//
// The thresholds keep us from flapping on a single bad probe (which happens
// — network blips). For severity, we just use "down" for now; future work
// could add "degraded" for projects with high latency but ok responses.
package uptime

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	failuresToOpen  = 3
	successesToShut = 3
)

// evaluateIncident is called once per probe insert. Cheap query + at most
// one INSERT or UPDATE. Errors are logged, not returned — the probe still
// recorded successfully.
func evaluateIncident(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID, lastOK bool, lastStatus int, lastErr string) {
	// Pull the most recent N + 1 checks for this project so we can tell
	// whether the last `failuresToOpen` are all failing (or the last
	// `successesToShut` all passing).
	n := max(failuresToOpen, successesToShut)
	rows, err := pool.Query(ctx, `
		SELECT ok, status_code, error
		FROM uptime_checks
		WHERE project_id = $1
		ORDER BY checked_at DESC
		LIMIT $2
	`, projectID, n)
	if err != nil {
		log.Printf("incidents: load recent for %s: %v", projectID, err)
		return
	}
	type row struct {
		ok     bool
		status int
		errMsg *string
	}
	var recent []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.ok, &r.status, &r.errMsg); err != nil {
			rows.Close()
			return
		}
		recent = append(recent, r)
	}
	rows.Close()

	if len(recent) < failuresToOpen {
		// Too early in the prober's life to evaluate.
		return
	}

	// Look up existing open incident (partial unique index makes this fast).
	var openID *uuid.UUID
	err = pool.QueryRow(ctx,
		`SELECT id FROM incidents WHERE project_id = $1 AND ended_at IS NULL`,
		projectID,
	).Scan(&openID)
	if err != nil && err != pgx.ErrNoRows {
		log.Printf("incidents: query open for %s: %v", projectID, err)
		return
	}

	// All N most recent failed?
	allFailed := true
	for i := 0; i < failuresToOpen && i < len(recent); i++ {
		if recent[i].ok {
			allFailed = false
			break
		}
	}

	// All N most recent succeeded?
	allOK := true
	for i := 0; i < successesToShut && i < len(recent); i++ {
		if !recent[i].ok {
			allOK = false
			break
		}
	}

	if openID == nil && allFailed {
		openIncident(ctx, pool, projectID, lastStatus, lastErr)
		return
	}
	if openID != nil && allOK {
		closeIncident(ctx, pool, *openID)
		return
	}
	// Open incident, still failing — bump last_failure_at for sorting.
	if openID != nil && !lastOK {
		_, _ = pool.Exec(ctx,
			`UPDATE incidents SET last_failure_at = now() WHERE id = $1`,
			*openID,
		)
	}
}

func openIncident(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID, status int, errMsg string) {
	// Look up the project's owning user. We denormalize user_id onto the
	// incident row so /incidents can be a simple per-user scan.
	var userID uuid.UUID
	err := pool.QueryRow(ctx, `
		SELECT pc.user_id
		FROM projects p
		JOIN provider_connections pc ON pc.id = p.connection_id
		WHERE p.id = $1
	`, projectID).Scan(&userID)
	if err != nil {
		// Orphan project (no connection) — can't attribute. Skip.
		return
	}

	var errCol *string
	if errMsg != "" {
		errCol = &errMsg
	}
	statusVal := &status
	if status == 0 {
		statusVal = nil
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO incidents (id, project_id, user_id, first_status, first_error, last_failure_at)
		VALUES ($1, $2, $3, $4, $5, now())
		ON CONFLICT (project_id) WHERE ended_at IS NULL DO NOTHING
	`, uuid.New(), projectID, userID, statusVal, errCol)
	if err != nil {
		log.Printf("incidents: open for %s: %v", projectID, err)
		return
	}
	log.Printf("incidents: opened for project %s (status=%d)", projectID, status)
}

func closeIncident(ctx context.Context, pool *pgxpool.Pool, incidentID uuid.UUID) {
	_, err := pool.Exec(ctx, `
		UPDATE incidents
		SET ended_at    = now(),
		    duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::bigint
		WHERE id = $1 AND ended_at IS NULL
	`, incidentID)
	if err != nil {
		log.Printf("incidents: close %s: %v", incidentID, err)
		return
	}
	log.Printf("incidents: closed %s", incidentID)
}

// --- Reads (used by the API) ---

type Incident struct {
	ID            uuid.UUID  `json:"id"`
	ProjectID     uuid.UUID  `json:"projectId"`
	ProjectName   string     `json:"projectName"`
	StartedAt     time.Time  `json:"startedAt"`
	EndedAt       *time.Time `json:"endedAt"`
	DurationMs    int64      `json:"durationMs"`
	Severity      string     `json:"severity"`
	FirstStatus   *int       `json:"firstStatus,omitempty"`
	FirstError    *string    `json:"firstError,omitempty"`
	LastFailureAt *time.Time `json:"lastFailureAt,omitempty"`
}

// ListIncidentsForUser returns recent incidents across all of a user's
// projects, ordered by started_at desc.
func ListIncidentsForUser(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, limit int) ([]Incident, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := pool.Query(ctx, `
		SELECT i.id, i.project_id, p.name,
		       i.started_at, i.ended_at, i.duration_ms,
		       i.severity, i.first_status, i.first_error, i.last_failure_at
		FROM incidents i
		JOIN projects p ON p.id = i.project_id
		WHERE i.user_id = $1
		ORDER BY i.started_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Incident, 0)
	for rows.Next() {
		var i Incident
		if err := rows.Scan(&i.ID, &i.ProjectID, &i.ProjectName,
			&i.StartedAt, &i.EndedAt, &i.DurationMs,
			&i.Severity, &i.FirstStatus, &i.FirstError, &i.LastFailureAt); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// ListIncidentsForProject — used by project detail.
func ListIncidentsForProject(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID, limit int) ([]Incident, error) {
	if limit <= 0 || limit > 200 {
		limit = 30
	}
	rows, err := pool.Query(ctx, `
		SELECT i.id, i.project_id, p.name,
		       i.started_at, i.ended_at, i.duration_ms,
		       i.severity, i.first_status, i.first_error, i.last_failure_at
		FROM incidents i
		JOIN projects p ON p.id = i.project_id
		WHERE i.project_id = $1
		ORDER BY i.started_at DESC
		LIMIT $2
	`, projectID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Incident, 0)
	for rows.Next() {
		var i Incident
		if err := rows.Scan(&i.ID, &i.ProjectID, &i.ProjectName,
			&i.StartedAt, &i.EndedAt, &i.DurationMs,
			&i.Severity, &i.FirstStatus, &i.FirstError, &i.LastFailureAt); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// CurrentSSL returns the latest cert info for a project. Used by the
// project detail page's SSL card.
type SSLInfo struct {
	Issuer        string     `json:"issuer"`
	ExpiresAt     time.Time  `json:"expiresAt"`
	DaysRemaining int        `json:"daysRemaining"`
	CheckedAt     time.Time  `json:"checkedAt"`
}

func CurrentSSL(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID) (*SSLInfo, error) {
	var issuer string
	var expires, checked time.Time
	err := pool.QueryRow(ctx, `
		SELECT ssl_issuer, ssl_expires_at, checked_at
		FROM uptime_checks
		WHERE project_id = $1 AND ssl_expires_at IS NOT NULL
		ORDER BY checked_at DESC
		LIMIT 1
	`, projectID).Scan(&issuer, &expires, &checked)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	days := int(time.Until(expires).Hours() / 24)
	return &SSLInfo{
		Issuer:        issuer,
		ExpiresAt:     expires,
		DaysRemaining: days,
		CheckedAt:     checked,
	}, nil
}

// max() removed — Go 1.21+ ships it as a built-in.
