package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"net/mail"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahomsi0/opslens/backend/internal/auth"
	"github.com/ahomsi0/opslens/backend/internal/db"
)

type AuthAPI struct {
	Pool *pgxpool.Pool
}

// GET /api/auth/me — returns the current user, or 401.
func (a *AuthAPI) Me(w http.ResponseWriter, r *http.Request) {
	id, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	u, err := db.GetUserByID(r.Context(), a.Pool, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user": u,
		"providers": map[string]bool{
			"github":   auth.GithubConfigured(),
			"password": true,
		},
	})
}

// GET /api/auth/config — public, tells the frontend which sign-in methods are available.
func (a *AuthAPI) Config(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"github":   auth.GithubConfigured(),
		"password": true,
	})
}

type signupReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func (a *AuthAPI) Signup(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var req signupReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || req.Password == "" {
		writeErr(w, http.StatusBadRequest, "email and password are required")
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid email")
		return
	}
	if len(req.Password) < 8 {
		writeErr(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if req.Name == "" {
		// derive a friendly name from the email local-part
		req.Name = strings.Split(req.Email, "@")[0]
	}

	// Reject duplicates explicitly so the UI can show a useful message.
	if existing, err := db.GetUserByEmail(r.Context(), a.Pool, req.Email); err == nil && existing != nil {
		writeErr(w, http.StatusConflict, "An account with this email already exists. Try signing in.")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not hash password")
		return
	}

	// Determine whether this is the first user (so we can claim orphaned data).
	count, _ := db.UsersCount(r.Context(), a.Pool)

	u, err := db.CreateUser(r.Context(), a.Pool, db.CreateUserParams{
		Email:        req.Email,
		Name:         req.Name,
		PasswordHash: hash,
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create user: "+err.Error())
		return
	}

	if count == 0 {
		if n, err := db.ClaimOrphanedConnections(r.Context(), a.Pool, u.ID); err == nil && n > 0 {
			log.Printf("auth: first user %s claimed %d orphaned connections", u.Email, n)
		}
	}

	a.startSession(w, r, u.ID)
	writeJSON(w, http.StatusCreated, map[string]any{"user": u})
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (a *AuthAPI) Login(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || req.Password == "" {
		writeErr(w, http.StatusBadRequest, "email and password are required")
		return
	}
	u, err := db.GetUserByEmail(r.Context(), a.Pool, req.Email)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err := auth.VerifyPassword(req.Password, u.PasswordHash); err != nil {
		writeErr(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	a.startSession(w, r, u.ID)
	writeJSON(w, http.StatusOK, map[string]any{"user": u})
}

func (a *AuthAPI) Logout(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie(auth.CookieName)
	if err == nil && c.Value != "" {
		_ = auth.DeleteSession(r.Context(), a.Pool, c.Value)
	}
	auth.ClearCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/auth/github/start — kicks off OAuth.
func (a *AuthAPI) GithubStart(w http.ResponseWriter, r *http.Request) {
	if !auth.GithubConfigured() {
		writeErr(w, http.StatusServiceUnavailable, "GitHub OAuth is not configured")
		return
	}
	// Best-effort state: random hex placed in a short-lived cookie. We
	// re-check it on callback to deter CSRF.
	state, err := newOAuthState()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "opslens_oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
		MaxAge:   600,
	})
	http.Redirect(w, r, auth.GithubAuthorizeURL(state), http.StatusFound)
}

// GET /api/auth/github/callback — finishes OAuth, sets session, redirects.
func (a *AuthAPI) GithubCallback(w http.ResponseWriter, r *http.Request) {
	frontend := os.Getenv("FRONTEND_URL")
	if frontend == "" {
		frontend = "/"
	}

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if code == "" {
		http.Redirect(w, r, frontend+"/login?error=missing_code", http.StatusFound)
		return
	}

	expectedCookie, _ := r.Cookie("opslens_oauth_state")
	if expectedCookie == nil || expectedCookie.Value == "" || expectedCookie.Value != state {
		http.Redirect(w, r, frontend+"/login?error=bad_state", http.StatusFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	gh, err := auth.GithubExchange(ctx, code)
	if err != nil {
		log.Printf("auth: github exchange failed: %v", err)
		http.Redirect(w, r, frontend+"/login?error=exchange_failed", http.StatusFound)
		return
	}
	if gh.Email == "" {
		http.Redirect(w, r, frontend+"/login?error=no_email", http.StatusFound)
		return
	}

	// Find-or-create the user.
	var user *db.User
	if existing, err := db.GetUserByGithubID(ctx, a.Pool, gh.ID); err == nil {
		user = existing
	} else if existing, err := db.GetUserByEmail(ctx, a.Pool, gh.Email); err == nil {
		// Email matches a previously-created (email/password) user — link them.
		user = existing
		_, _ = a.Pool.Exec(ctx, `
			UPDATE users SET github_id = $1, avatar_url = COALESCE(NULLIF($2,''), avatar_url)
			WHERE id = $3
		`, gh.ID, gh.AvatarURL, existing.ID)
	} else {
		// Fresh signup.
		count, _ := db.UsersCount(ctx, a.Pool)
		gid := gh.ID
		newU, err := db.CreateUser(ctx, a.Pool, db.CreateUserParams{
			Email:     gh.Email,
			Name:      gh.Name,
			GithubID:  &gid,
			AvatarURL: gh.AvatarURL,
		})
		if err != nil {
			log.Printf("auth: github create user failed: %v", err)
			http.Redirect(w, r, frontend+"/login?error=create_failed", http.StatusFound)
			return
		}
		user = newU
		if count == 0 {
			if n, _ := db.ClaimOrphanedConnections(ctx, a.Pool, user.ID); n > 0 {
				log.Printf("auth: first user %s claimed %d orphaned connections", user.Email, n)
			}
		}
	}

	a.startSession(w, r, user.ID)

	// Clear the state cookie.
	http.SetCookie(w, &http.Cookie{
		Name:     "opslens_oauth_state",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
		MaxAge:   -1,
	})

	http.Redirect(w, r, frontend+"/dashboard", http.StatusFound)
}

func (a *AuthAPI) startSession(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	ua := r.UserAgent()
	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
	}
	token, err := auth.CreateSession(ctx, a.Pool, userID, ua, ip)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create session")
		return
	}
	auth.SetCookie(w, token)
}

// newOAuthState returns a random hex token used to deter CSRF on the
// GitHub OAuth callback. We stash it in a short-lived cookie at start and
// require it back on callback.
func newOAuthState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
