package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahomsi0/opslens/backend/internal/auth"
	"github.com/ahomsi0/opslens/backend/internal/db"
	"github.com/ahomsi0/opslens/backend/internal/metrics"
	"github.com/ahomsi0/opslens/backend/internal/models"
	"github.com/ahomsi0/opslens/backend/internal/uptime"
)

// Window we report uptime over. 30 days is the dashboard's standard window.
const uptimeWindow = 30 * 24 * time.Hour

type API struct {
	Pool *pgxpool.Pool
	Hub  *metrics.Hub
}

func (a *API) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ts": time.Now().UTC()})
}

func (a *API) ListProjects(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := auth.MustUser(ctx)
	projects, err := db.ListProjectsForUser(ctx, a.Pool, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Real uptime: one batched query for all the user's projects.
	ids := make([]uuid.UUID, 0, len(projects))
	for _, p := range projects {
		ids = append(ids, p.ID)
	}
	upMap, _ := uptime.GetMany(ctx, a.Pool, ids, uptimeWindow)

	out := make([]models.ProjectSummary, 0, len(projects))
	for _, p := range projects {
		s := models.ProjectSummary{Project: p}
		if st, ok := upMap[p.ID]; ok && st.HasData {
			s.UptimePct = st.Percent
			s.UptimeWindowH = st.WindowH
		} else {
			s.UptimePct = -1 // signal "no data yet" — frontend shows '—'
		}
		s.ActiveIncidents = incidentsFor(p)

		// p95 latency + sparkline from live buffer
		snap := a.Hub.Snapshot(p.ID)
		if len(snap) > 0 {
			s.LatencyP95Ms = p95Latency(snap)
			spark := make([]int, 0, len(snap))
			step := 1
			if len(snap) > 60 {
				step = len(snap) / 60
			}
			for i := 0; i < len(snap); i += step {
				spark = append(spark, int(snap[i].LatencyMs))
			}
			s.LatencySpark = spark
		} else {
			s.LatencySpark = []int{}
		}

		last, _ := db.LatestDeployment(ctx, a.Pool, p.ID)
		s.LastDeployment = last
		out = append(out, s)
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": out})
}

func (a *API) GetProject(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := auth.MustUser(ctx)
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	p, err := db.GetProjectForUser(ctx, a.Pool, userID, id)
	if errors.Is(err, db.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	deps, _ := db.ListDeployments(ctx, a.Pool, id, 10)

	summary := models.ProjectSummary{Project: *p}
	if st, _ := uptime.Get(ctx, a.Pool, id, uptimeWindow); st != nil && st.HasData {
		summary.UptimePct = st.Percent
		summary.UptimeWindowH = st.WindowH
	} else {
		summary.UptimePct = -1
	}
	summary.ActiveIncidents = incidentsFor(*p)
	snap := a.Hub.Snapshot(id)
	summary.LatencyP95Ms = p95Latency(snap)

	writeJSON(w, http.StatusOK, map[string]any{
		"project":     summary,
		"deployments": deps,
	})
}

func (a *API) ListDeployments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := auth.MustUser(ctx)
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	// Ownership gate — same project visibility as GetProjectForUser.
	if _, err := db.GetProjectForUser(ctx, a.Pool, userID, id); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	deps, err := db.ListDeployments(ctx, a.Pool, id, limit)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deployments": deps})
}

func (a *API) ListLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := auth.MustUser(ctx)
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if _, err := db.GetProjectForUser(ctx, a.Pool, userID, id); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	q := r.URL.Query()
	filter := db.LogFilter{
		Query: q.Get("q"),
	}
	if lv := q.Get("level"); lv != "" {
		filter.Levels = strings.Split(lv, ",")
	}
	if c := q.Get("cursor"); c != "" {
		if v, err := strconv.ParseInt(c, 10, 64); err == nil {
			filter.Before = v
		}
	}
	if l := q.Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			filter.Limit = v
		}
	}
	logs, err := db.ListLogs(ctx, a.Pool, id, filter)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	var nextCursor *int64
	if len(logs) > 0 {
		nc := logs[len(logs)-1].ID
		nextCursor = &nc
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"logs":       logs,
		"nextCursor": nextCursor,
	})
}

// -- helpers --

func incidentsFor(p models.Project) int {
	switch p.Status {
	case "degraded":
		return 1
	case "down":
		return 2
	default:
		return 0
	}
}

func p95Latency(snap []models.MetricFrame) int {
	if len(snap) == 0 {
		return 0
	}
	vals := make([]float64, len(snap))
	for i, f := range snap {
		vals[i] = f.LatencyMs
	}
	// quick insertion sort (n <= 300)
	for i := 1; i < len(vals); i++ {
		for j := i; j > 0 && vals[j-1] > vals[j]; j-- {
			vals[j-1], vals[j] = vals[j], vals[j-1]
		}
	}
	idx := int(float64(len(vals)) * 0.95)
	if idx >= len(vals) {
		idx = len(vals) - 1
	}
	return int(vals[idx])
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
