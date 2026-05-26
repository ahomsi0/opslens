package db

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	PasswordHash string    `json:"-"`
	GithubID     *int64    `json:"-"`
	AvatarURL    string    `json:"avatarUrl"`
	CreatedAt    time.Time `json:"createdAt"`
}

func GetUserByID(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (*User, error) {
	row := pool.QueryRow(ctx, `
		SELECT id, email, name, COALESCE(password_hash, ''), github_id, COALESCE(avatar_url, ''), created_at
		FROM users WHERE id = $1
	`, id)
	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.GithubID, &u.AvatarURL, &u.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

func GetUserByEmail(ctx context.Context, pool *pgxpool.Pool, email string) (*User, error) {
	row := pool.QueryRow(ctx, `
		SELECT id, email, name, COALESCE(password_hash, ''), github_id, COALESCE(avatar_url, ''), created_at
		FROM users WHERE lower(email) = lower($1)
	`, strings.TrimSpace(email))
	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.GithubID, &u.AvatarURL, &u.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

func GetUserByGithubID(ctx context.Context, pool *pgxpool.Pool, ghID int64) (*User, error) {
	row := pool.QueryRow(ctx, `
		SELECT id, email, name, COALESCE(password_hash, ''), github_id, COALESCE(avatar_url, ''), created_at
		FROM users WHERE github_id = $1
	`, ghID)
	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.GithubID, &u.AvatarURL, &u.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

type CreateUserParams struct {
	Email        string
	Name         string
	PasswordHash string  // empty for OAuth-only signup
	GithubID     *int64  // nil for email/password signup
	AvatarURL    string
}

func CreateUser(ctx context.Context, pool *pgxpool.Pool, p CreateUserParams) (*User, error) {
	id := uuid.New()
	now := time.Now().UTC()
	var hash *string
	if p.PasswordHash != "" {
		hash = &p.PasswordHash
	}
	_, err := pool.Exec(ctx, `
		INSERT INTO users (id, email, name, password_hash, github_id, avatar_url, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
	`, id, strings.TrimSpace(p.Email), strings.TrimSpace(p.Name), hash, p.GithubID, p.AvatarURL, now)
	if err != nil {
		return nil, err
	}
	return GetUserByID(ctx, pool, id)
}

// FirstUserCount returns the total number of users. Used by signup to decide
// whether to claim orphaned (user_id IS NULL) provider_connections rows.
func UsersCount(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&n)
	return n, err
}

// ClaimOrphanedConnections assigns any provider_connections rows with a
// NULL user_id (left over from the pre-auth deploy) to the given user.
// Returns how many rows were claimed.
func ClaimOrphanedConnections(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (int, error) {
	tag, err := pool.Exec(ctx, `
		UPDATE provider_connections SET user_id = $1 WHERE user_id IS NULL
	`, userID)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}
