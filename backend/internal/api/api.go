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

// Shorter window for "current" latency stats on cards. Long enough to be
// stable, short enough to reflect recent state.
const latencyWindow = 24 * time.Hour

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

		// Real latency from uptime probes (last 24h).
		if lat, _ := uptime.LatencyNow(ctx, a.Pool, p.ID, latencyWindow); lat != nil {
			s.LatencyP95Ms = lat.P95
		}
		// Sparkline from binned probe history (24h, 1h buckets → 24 points).
		series, _ := uptime.TimeSeries(ctx, a.Pool, p.ID, 24*time.Hour, time.Hour)
		spark := make([]int, 0, len(series))
		for _, pt := range series {
			spark = append(spark, pt.P95)
		}
		s.LatencySpark = spark

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
	if lat, _ := uptime.LatencyNow(ctx, a.Pool, id, latencyWindow); lat != nil {
		summary.LatencyP95Ms = lat.P95
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"project":     summary,
		"deployments": deps,
	})
}

// Metrics returns the real time-series data for the project detail page.
// Pulls from uptime_checks; supports ?window=24h|7d|30d. CPU/memory/network
// are NOT included because we don't have a source for them on free-tier
// providers — see liveMetrics flag.
func (a *API) ProjectMetrics(w http.ResponseWriter, r *http.Request) {
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

	window := 24 * time.Hour
	bucket := 15 * time.Minute
	switch r.URL.Query().Get("window") {
	case "7d":
		window = 7 * 24 * time.Hour
		bucket = 2 * time.Hour
	case "30d":
		window = 30 * 24 * time.Hour
		bucket = 8 * time.Hour
	}

	series, err := uptime.TimeSeries(ctx, a.Pool, id, window, bucket)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	summary, _ := uptime.LatencyNow(ctx, a.Pool, id, window)
	up, _ := uptime.Get(ctx, a.Pool, id, window)

	writeJSON(w, http.StatusOK, map[string]any{
		"latency": map[string]any{
			"series":  series,
			"summary": summary,
		},
		"uptime": up,
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
