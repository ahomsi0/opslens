package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahomsi0/opslens/backend/internal/crypto"
	"github.com/ahomsi0/opslens/backend/internal/providers/docker"
)

// DockerAPI handles POST /api/docker/heartbeat from agents running on
// users' Docker hosts. Authentication is a bearer token issued at
// connection-creation time.
type DockerAPI struct {
	Pool   *pgxpool.Pool
	Sealer *crypto.Sealer
}

func (a *DockerAPI) Heartbeat(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		writeErr(w, http.StatusUnauthorized, "missing bearer token")
		return
	}
	token := strings.TrimPrefix(auth, "Bearer ")

	conn, err := docker.FindByToken(r.Context(), a.Pool, a.Sealer.DecryptString, token)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "invalid agent token")
		return
	}

	var hb docker.Heartbeat
	if err := json.NewDecoder(r.Body).Decode(&hb); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if err := docker.Apply(r.Context(), a.Pool, *conn, hb); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"containers": len(hb.Containers),
	})
}
