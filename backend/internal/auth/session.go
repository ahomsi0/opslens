// Server-side sessions. The browser holds an HTTP-only secure cookie
// `opslens_session=sess_<hex>` which maps to a row in the sessions table.
package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	CookieName     = "opslens_session"
	SessionTTL     = 30 * 24 * time.Hour
	sessionPrefix  = "sess_"
)

var ErrNoSession = errors.New("no session")

func newToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return sessionPrefix + hex.EncodeToString(b), nil
}

// CreateSession inserts a fresh session row and returns the token to set on
// the client.
func CreateSession(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, ua, ip string) (string, error) {
	token, err := newToken()
	if err != nil {
		return "", err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO sessions (token, user_id, expires_at, user_agent, ip)
		VALUES ($1, $2, $3, $4, $5)
	`, token, userID, time.Now().Add(SessionTTL), ua, ip)
	if err != nil {
		return "", err
	}
	return token, nil
}

// LookupSession resolves a session token to its user_id, if the session
// exists and is not expired.
func LookupSession(ctx context.Context, pool *pgxpool.Pool, token string) (uuid.UUID, error) {
	var userID uuid.UUID
	var expiresAt time.Time
	err := pool.QueryRow(ctx, `
		SELECT user_id, expires_at FROM sessions WHERE token = $1
	`, token).Scan(&userID, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrNoSession
	}
	if err != nil {
		return uuid.Nil, err
	}
	if time.Now().After(expiresAt) {
		return uuid.Nil, ErrNoSession
	}
	return userID, nil
}

func DeleteSession(ctx context.Context, pool *pgxpool.Pool, token string) error {
	_, err := pool.Exec(ctx, `DELETE FROM sessions WHERE token = $1`, token)
	return err
}

// SetCookie writes the session token onto the response as an HTTP-only,
// secure, SameSite=None cookie so cross-origin (frontend.vercel.app →
// backend.onrender.com) requests can include it via fetch credentials.
func SetCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
		MaxAge:   int(SessionTTL.Seconds()),
	})
}

// ClearCookie expires the session cookie on the client.
func ClearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
		MaxAge:   -1,
	})
}
