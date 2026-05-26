package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahomsi0/opslens/backend/internal/models"
)

var ErrNotFound = errors.New("not found")

const projectCols = `id, name, slug, provider, environment, region, repo_url, domain,
                     status, created_at, source, connection_id, external_id, live_metrics`

func scanProject(row interface {
	Scan(dest ...any) error
}) (models.Project, error) {
	var p models.Project
	err := row.Scan(&p.ID, &p.Name, &p.Slug, &p.Provider, &p.Environment, &p.Region,
		&p.RepoURL, &p.Domain, &p.Status, &p.CreatedAt,
		&p.Source, &p.ConnectionID, &p.ExternalID, &p.LiveMetrics)
	return p, err
}

func ListProjects(ctx context.Context, pool *pgxpool.Pool) ([]models.Project, error) {
	rows, err := pool.Query(ctx, `
		SELECT `+projectCols+`
		FROM projects
		ORDER BY (source = 'demo'), created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Project, 0)
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func GetProject(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (*models.Project, error) {
	row := pool.QueryRow(ctx, `SELECT `+projectCols+` FROM projects WHERE id = $1`, id)
	p, err := scanProject(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func GetProjectBySlug(ctx context.Context, pool *pgxpool.Pool, slug string) (*models.Project, error) {
	row := pool.QueryRow(ctx, `SELECT `+projectCols+` FROM projects WHERE slug = $1 LIMIT 1`, slug)
	p, err := scanProject(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ListProjectsWithLiveMetrics returns only projects that should have synthetic
// live metric generators attached (i.e. demo projects + projects from providers
// that expose live metrics — currently 'demo' only).
func ListProjectsWithLiveMetrics(ctx context.Context, pool *pgxpool.Pool) ([]models.Project, error) {
	rows, err := pool.Query(ctx, `
		SELECT `+projectCols+`
		FROM projects WHERE live_metrics = TRUE
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Project, 0)
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func LatestDeployment(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID) (*models.Deployment, error) {
	var d models.Deployment
	err := pool.QueryRow(ctx, `
		SELECT id, project_id, status, commit_sha, commit_msg, author, branch, duration_ms, created_at
		FROM deployments
		WHERE project_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, projectID).Scan(&d.ID, &d.ProjectID, &d.Status, &d.CommitSHA, &d.CommitMsg, &d.Author, &d.Branch, &d.DurationMs, &d.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func ListDeployments(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID, limit int) ([]models.Deployment, error) {
	if limit <= 0 || limit > 200 {
		limit = 30
	}
	rows, err := pool.Query(ctx, `
		SELECT id, project_id, status, commit_sha, commit_msg, author, branch, duration_ms, created_at
		FROM deployments
		WHERE project_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, projectID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Deployment, 0)
	for rows.Next() {
		var d models.Deployment
		if err := rows.Scan(&d.ID, &d.ProjectID, &d.Status, &d.CommitSHA, &d.CommitMsg, &d.Author, &d.Branch, &d.DurationMs, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

type LogFilter struct {
	Levels []string
	Query  string
	Limit  int
	Before int64 // cursor by log id
}

func ListLogs(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID, f LogFilter) ([]models.LogEntry, error) {
	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 200
	}
	args := []any{projectID}
	where := "project_id = $1"
	idx := 2
	if len(f.Levels) > 0 {
		where += fmt.Sprintf(" AND level = ANY($%d)", idx)
		args = append(args, f.Levels)
		idx++
	}
	if f.Query != "" {
		where += fmt.Sprintf(" AND message ILIKE $%d", idx)
		args = append(args, "%"+f.Query+"%")
		idx++
	}
	if f.Before > 0 {
		where += fmt.Sprintf(" AND id < $%d", idx)
		args = append(args, f.Before)
		idx++
	}
	q := fmt.Sprintf(`
		SELECT id, project_id, level, source, message, created_at
		FROM logs
		WHERE %s
		ORDER BY id DESC
		LIMIT $%d
	`, where, idx)
	args = append(args, f.Limit)

	rows, err := pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.LogEntry, 0)
	for rows.Next() {
		var l models.LogEntry
		if err := rows.Scan(&l.ID, &l.ProjectID, &l.Level, &l.Source, &l.Message, &l.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// CountProjects returns total project count.
func CountProjects(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM projects`).Scan(&n)
	return n, err
}
