package db

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse db url: %w", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	return pool, nil
}

// Migrate runs each embedded .sql file exactly once. A schema_migrations
// table tracks which have been applied so we never re-run them (re-running
// older migrations breaks once later ones rename/drop columns they reference).
//
// On first upgrade from the un-tracked era, we backfill the table by
// detecting which schema objects already exist — so existing deploys don't
// try to re-apply migrations and explode.
func Migrate(ctx context.Context, pool *pgxpool.Pool, migrations fs.FS) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename   TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	// Backfill: detect previously-applied migrations on existing databases.
	// Each entry pairs a filename with a check that proves the migration ran.
	backfills := []struct {
		filename string
		check    string
		args     []any
	}{
		{
			"001_init.sql",
			`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects'`,
			nil,
		},
		{
			"002_connections.sql",
			`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provider_connections'`,
			nil,
		},
		{
			"003_docker_tokens.sql",
			// 003 is a no-op (just SELECT 1). Consider it applied whenever
			// 002 is, since they ship together and 003 has no real effect.
			`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provider_connections'`,
			nil,
		},
		{
			"004_auth.sql",
			`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'`,
			nil,
		},
	}
	for _, bf := range backfills {
		var one int
		err := pool.QueryRow(ctx, bf.check, bf.args...).Scan(&one)
		if err != nil {
			// pgx returns ErrNoRows when the check yields nothing — that's fine,
			// just means the migration genuinely hasn't run.
			continue
		}
		if _, err := pool.Exec(ctx,
			`INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
			bf.filename,
		); err != nil {
			return fmt.Errorf("backfill %s: %w", bf.filename, err)
		}
	}

	// Discover migration files.
	var files []string
	err := fs.WalkDir(migrations, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(path, ".sql") {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return err
	}
	sort.Strings(files)

	// Skip ones already applied.
	rows, err := pool.Query(ctx, `SELECT filename FROM schema_migrations`)
	if err != nil {
		return fmt.Errorf("read schema_migrations: %w", err)
	}
	applied := map[string]bool{}
	for rows.Next() {
		var f string
		if err := rows.Scan(&f); err != nil {
			rows.Close()
			return err
		}
		applied[f] = true
	}
	rows.Close()

	for _, f := range files {
		if applied[f] {
			continue
		}
		data, err := fs.ReadFile(migrations, f)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", f, err)
		}
		if _, err := pool.Exec(ctx, string(data)); err != nil {
			return fmt.Errorf("apply %s: %w", f, err)
		}
		if _, err := pool.Exec(ctx,
			`INSERT INTO schema_migrations (filename) VALUES ($1)`,
			f,
		); err != nil {
			return fmt.Errorf("record applied %s: %w", f, err)
		}
	}
	return nil
}
