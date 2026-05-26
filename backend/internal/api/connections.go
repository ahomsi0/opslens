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

	"github.com/ahomsi0/opslens/backend/internal/crypto"
	"github.com/ahomsi0/opslens/backend/internal/db"
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
	conns, err := db.ListConnections(r.Context(), a.Pool, db.DefaultWorkspaceID)
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
	if req.Provider == "" || req.Token == "" {
		writeErr(w, http.StatusBadRequest, "provider and token are required")
		return
	}
	if req.Name == "" {
		req.Name = strings.ToUpper(req.Provider[:1]) + req.Provider[1:]
	}

	// Validate the token against the provider before storing anything.
	var accountLabel string
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	switch req.Provider {
	case "vercel":
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
	default:
		writeErr(w, http.StatusBadRequest, "unsupported provider: "+req.Provider)
		return
	}

	enc, err := a.Sealer.EncryptString(req.Token)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "encryption failed")
		return
	}
	conn, err := db.CreateConnection(r.Context(), a.Pool,
		db.DefaultWorkspaceID, req.Provider, req.Name, accountLabel, enc)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Kick off an immediate sync in the background so the user sees their
	// real projects within a few seconds of clicking Connect.
	go func() {
		bg, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		if err := a.Syncer.SyncNow(bg, conn.ID.String()); err != nil {
			// already logged inside the syncer
			_ = err
		}
	}()

	writeJSON(w, http.StatusCreated, conn)
}

func (a *ConnectionAPI) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
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
