package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahomsi0/opslens/backend/internal/auth"
	"github.com/ahomsi0/opslens/backend/internal/crypto"
	"github.com/ahomsi0/opslens/backend/internal/db"
	"github.com/ahomsi0/opslens/backend/internal/providers/docker"
	"github.com/ahomsi0/opslens/backend/internal/providers/neon"
	"github.com/ahomsi0/opslens/backend/internal/providers/railway"
	"github.com/ahomsi0/opslens/backend/internal/providers/render"
	"github.com/ahomsi0/opslens/backend/internal/providers/supabase"
	"github.com/ahomsi0/opslens/backend/internal/providers/vercel"
)

// Syncer is an interface so the API package doesn't pull in the providers
// package (which would create an import cycle through metrics).
type Syncer interface {
	SyncNow(ctx context.Context, connectionID string) error
}

type ConnectionAPI struct {
	Pool   *pgxpool.Pool
	Sealer *crypto.Sealer
	Syncer Syncer
}

func (a *ConnectionAPI) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.MustUser(r.Context())
	conns, err := db.ListConnections(r.Context(), a.Pool, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"connections": conns})
}

type createReq struct {
	Provider string `json:"provider"`
	Name     string `json:"name"`
	Token    string `json:"token"`
	HostName string `json:"hostName,omitempty"` // docker only
}

type dockerCreateResp struct {
	Connection db.Connection `json:"connection"`
	AgentToken string        `json:"agentToken"`
}

func (a *ConnectionAPI) Create(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	var req createReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Provider = strings.TrimSpace(strings.ToLower(req.Provider))
	req.Name = strings.TrimSpace(req.Name)
	req.Token = strings.TrimSpace(req.Token)
	if req.Provider == "" {
		writeErr(w, http.StatusBadRequest, "provider is required")
		return
	}
	if req.Name == "" {
		req.Name = strings.ToUpper(req.Provider[:1]) + req.Provider[1:]
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	var accountLabel string
	var tokenToStore string

	switch req.Provider {
	case "vercel":
		if req.Token == "" {
			writeErr(w, http.StatusBadRequest, "token is required")
			return
		}
		user, err := vercel.NewClient(req.Token).VerifyToken(ctx)
		if err != nil {
			if errors.Is(err, vercel.ErrInvalidToken) {
				writeErr(w, http.StatusUnauthorized, "Vercel rejected the token")
				return
			}
			writeErr(w, http.StatusBadGateway, "could not reach Vercel: "+err.Error())
			return
		}
		accountLabel = user.Username
		if accountLabel == "" {
			accountLabel = user.Email
		}
		tokenToStore = req.Token

	case "render":
		if req.Token == "" {
			writeErr(w, http.StatusBadRequest, "token is required")
			return
		}
		owner, err := render.NewClient(req.Token).VerifyToken(ctx)
		if err != nil {
			if errors.Is(err, render.ErrInvalidToken) {
				writeErr(w, http.StatusUnauthorized, "Render rejected the token")
				return
			}
			writeErr(w, http.StatusBadGateway, "could not reach Render: "+err.Error())
			return
		}
		accountLabel = owner.Name
		if accountLabel == "" {
			accountLabel = owner.Email
		}
		tokenToStore = req.Token

	case "neon":
		if req.Token == "" {
			writeErr(w, http.StatusBadRequest, "token is required")
			return
		}
		user, err := neon.NewClient(req.Token).VerifyToken(ctx)
		if err != nil {
			if errors.Is(err, neon.ErrInvalidToken) {
				writeErr(w, http.StatusUnauthorized, "Neon rejected the token")
				return
			}
			writeErr(w, http.StatusBadGateway, "could not reach Neon: "+err.Error())
			return
		}
		accountLabel = user.Login
		if accountLabel == "" {
			accountLabel = user.Email
		}
		if accountLabel == "" {
			accountLabel = user.Name
		}
		tokenToStore = req.Token

	case "supabase":
		if req.Token == "" {
			writeErr(w, http.StatusBadRequest, "token is required")
			return
		}
		orgName, err := supabase.NewClient(req.Token).VerifyToken(ctx)
		if err != nil {
			if errors.Is(err, supabase.ErrInvalidToken) {
				writeErr(w, http.StatusUnauthorized, "Supabase rejected the token")
				return
			}
			writeErr(w, http.StatusBadGateway, "could not reach Supabase: "+err.Error())
			return
		}
		accountLabel = orgName
		tokenToStore = req.Token

	case "railway":
		if req.Token == "" {
			writeErr(w, http.StatusBadRequest, "token is required")
			return
		}
		user, err := railway.NewClient(req.Token).VerifyToken(ctx)
		if err != nil {
			if errors.Is(err, railway.ErrInvalidToken) {
				writeErr(w, http.StatusUnauthorized, "Railway rejected the token")
				return
			}
			writeErr(w, http.StatusBadGateway, "could not reach Railway: "+err.Error())
			return
		}
		accountLabel = user.Name
		if accountLabel == "" {
			accountLabel = user.Email
		}
		tokenToStore = req.Token

	case "docker":
		// Docker doesn't require a SaaS token. We generate a heartbeat token
		// the user installs on their host.
		host := strings.TrimSpace(req.HostName)
		if host == "" {
			host = "docker-host"
		}
		accountLabel = host
		tokenToStore = docker.NewToken()

	default:
		writeErr(w, http.StatusBadRequest, "unsupported provider: "+req.Provider)
		return
	}

	enc, err := a.Sealer.EncryptString(tokenToStore)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "encryption failed")
		return
	}
	userID := auth.MustUser(r.Context())
	conn, err := db.CreateConnection(r.Context(), a.Pool,
		userID, req.Provider, req.Name, accountLabel, enc)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Kick off an immediate sync (no-op for docker which uses push).
	go func() {
		bg, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		_ = a.Syncer.SyncNow(bg, conn.ID.String())
	}()

	// Docker connections need to return the plain-text agent token once so
	// the user can install it on their host. All other providers just return
	// the connection metadata.
	if req.Provider == "docker" {
		writeJSON(w, http.StatusCreated, dockerCreateResp{
			Connection: conn,
			AgentToken: tokenToStore,
		})
		return
	}
	writeJSON(w, http.StatusCreated, conn)
}

func (a *ConnectionAPI) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	userID := auth.MustUser(r.Context())
	// Verify ownership before deleting. Quick row lookup beats an opaque 404.
	var ownerID *uuid.UUID
	err = a.Pool.QueryRow(r.Context(),
		`SELECT user_id FROM provider_connections WHERE id = $1`, id,
	).Scan(&ownerID)
	if err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if ownerID == nil || *ownerID != userID {
		writeErr(w, http.StatusForbidden, "not yours")
		return
	}
	if err := db.DeleteConnection(r.Context(), a.Pool, id); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
