package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/ahomsi0/opslens/backend/internal/auth"
	"github.com/ahomsi0/opslens/backend/internal/db"
	"github.com/ahomsi0/opslens/backend/internal/uptime"
)

// ListIncidents returns recent incidents across all of the current user's
// projects. Used by the /incidents page.
func (a *API) ListIncidents(w http.ResponseWriter, r *http.Request) {
	userID := auth.MustUser(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	incidents, err := uptime.ListIncidentsForUser(r.Context(), a.Pool, userID, limit)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"incidents": incidents})
}

// ListProjectIncidents — used by the project detail page.
func (a *API) ListProjectIncidents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := auth.MustUser(ctx)
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	// Ownership check.
	if _, err := db.GetProjectForUser(ctx, a.Pool, userID, id); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	incidents, err := uptime.ListIncidentsForProject(ctx, a.Pool, id, limit)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	ssl, _ := uptime.CurrentSSL(ctx, a.Pool, id)
	writeJSON(w, http.StatusOK, map[string]any{
		"incidents": incidents,
		"ssl":       ssl,
	})
}
