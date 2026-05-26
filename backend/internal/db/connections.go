package db

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DefaultWorkspaceID is the placeholder workspace until we add real auth.
// Stable UUID so the value is consistent across restarts.
var DefaultWorkspaceID = uuid.MustParse("00000000-0000-0000-0000-000000000001")

type Connection struct {
	ID             uuid.UUID  `json:"id"`
	WorkspaceID    uuid.UUID  `json:"workspaceId"`
	Provider       string     `json:"provider"`
	Name           string     `json:"name"`
	AccountLabel   *string    `json:"accountLabel,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	LastSyncedAt   *time.Time `json:"lastSyncedAt,omitempty"`
	LastError      *string    `json:"lastError,omitempty"`
}

type ConnectionWithToken struct {
	Connection
	EncryptedToken []byte
}

func ListConnections(ctx context.Context, pool *pgxpool.Pool, workspaceID uuid.UUID) ([]Connection, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, workspace_id, provider, name, account_label, created_at, last_synced_at, last_error
		FROM provider_connections
		WHERE workspace_id = $1
		ORDER BY created_at ASC
	`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Connection, 0)
	for rows.Next() {
		var c Connection
		if err := rows.Scan(&c.ID, &c.WorkspaceID, &c.Provider, &c.Name,
			&c.AccountLabel, &c.CreatedAt, &c.LastSyncedAt, &c.LastError); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func ListAllConnectionsWithTokens(ctx context.Context, pool *pgxpool.Pool) ([]ConnectionWithToken, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, workspace_id, provider, name, account_label, created_at,
		       last_synced_at, last_error, encrypted_token
		FROM provider_connections
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ConnectionWithToken, 0)
	for rows.Next() {
		var c ConnectionWithToken
		if err := rows.Scan(&c.ID, &c.WorkspaceID, &c.Provider, &c.Name,
			&c.AccountLabel, &c.CreatedAt, &c.LastSyncedAt, &c.LastError,
			&c.EncryptedToken); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func GetConnectionToken(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) ([]byte, error) {
	var token []byte
	err := pool.QueryRow(ctx,
		`SELECT encrypted_token FROM provider_connections WHERE id = $1`,
		id,
	).Scan(&token)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return token, err
}

func CreateConnection(
	ctx context.Context, pool *pgxpool.Pool,
	workspaceID uuid.UUID, provider, name, accountLabel string, encryptedToken []byte,
) (Connection, error) {
	id := uuid.New()
	now := time.Now().UTC()
	_, err := pool.Exec(ctx, `
		INSERT INTO provider_connections
		    (id, workspace_id, provider, name, account_label, encrypted_token, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, id, workspaceID, provider, name, accountLabel, encryptedToken, now)
	if err != nil {
		return Connection{}, err
	}
	label := accountLabel
	return Connection{
		ID: id, WorkspaceID: workspaceID, Provider: provider,
		Name: name, AccountLabel: &label, CreatedAt: now,
	}, nil
}

func DeleteConnection(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) error {
	tag, err := pool.Exec(ctx, `DELETE FROM provider_connections WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func RecordSyncError(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID, msg string) {
	_, _ = pool.Exec(ctx, `
		UPDATE provider_connections
		SET last_error = $2, last_synced_at = now()
		WHERE id = $1
	`, id, msg)
}
