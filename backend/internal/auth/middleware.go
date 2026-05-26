package auth

import (
	"context"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ctxKey struct{}

var userCtxKey = ctxKey{}

// UserFromContext returns the authenticated user id, if any.
func UserFromContext(ctx context.Context) (uuid.UUID, bool) {
	v, ok := ctx.Value(userCtxKey).(uuid.UUID)
	return v, ok
}

// WithUser injects a user id into the context.
func WithUser(ctx context.Context, id uuid.UUID) context.Context {
	return context.WithValue(ctx, userCtxKey, id)
}

// Resolve checks the session cookie. If valid, the user id is attached to
// the request context. Invalid cookies are silently ignored — downstream
// handlers can still require the user via RequireUser.
func Resolve(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie(CookieName)
			if err == nil && c.Value != "" {
				if id, err := LookupSession(r.Context(), pool, c.Value); err == nil {
					r = r.WithContext(WithUser(r.Context(), id))
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireUser is a per-route middleware that 401s if no session is attached.
func RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := UserFromContext(r.Context()); !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// MustUser is a helper for handlers that have already passed RequireUser.
func MustUser(ctx context.Context) uuid.UUID {
	id, ok := UserFromContext(ctx)
	if !ok {
		panic(errors.New("auth.MustUser called without a user in context"))
	}
	return id
}
