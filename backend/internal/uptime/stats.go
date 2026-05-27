package uptime

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Stats summarizes uptime over a rolling window.
type Stats struct {
	Percent  float64 // 0..100
	Total    int     // number of checks in window
	Failed   int     // number of failed checks in window
	WindowH  int     // hours covered (≤ requested window)
	HasData  bool    // false when no checks recorded yet
}

// Get computes uptime % for a project over the last `window`. Returns
// HasData=false when the project has no checks recorded yet.
//
// We also report how many hours of data we actually have — useful for
// surfacing "based on the last 4h" qualifiers when the data window is
// shorter than the requested one.
func Get(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID, window time.Duration) (*Stats, error) {
	var total, failed int
	var oldest *time.Time
	err := pool.QueryRow(ctx, `
		SELECT
		    count(*)::int,
		    count(*) FILTER (WHERE NOT ok)::int,
		    min(checked_at)
		FROM uptime_checks
		WHERE project_id = $1
		  AND checked_at > now() - $2::interval
	`, projectID, intervalString(window)).Scan(&total, &failed, &oldest)
	if err != nil {
		return nil, err
	}
	if total == 0 {
		return &Stats{HasData: false}, nil
	}
	pct := float64(total-failed) * 100.0 / float64(total)
	windowH := int(window.Hours())
	if oldest != nil {
		actual := time.Since(*oldest).Hours()
		if int(actual) < windowH {
			windowH = int(actual)
			if windowH < 1 {
				windowH = 1
			}
		}
	}
	return &Stats{
		Percent: pct,
		Total:   total,
		Failed:  failed,
		WindowH: windowH,
		HasData: true,
	}, nil
}

// GetMany batches the same query for a slice of project ids.
// Returns a map keyed by project id with the per-project stats.
func GetMany(ctx context.Context, pool *pgxpool.Pool, ids []uuid.UUID, window time.Duration) (map[uuid.UUID]*Stats, error) {
	out := map[uuid.UUID]*Stats{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := pool.Query(ctx, `
		SELECT
		    project_id,
		    count(*)::int,
		    count(*) FILTER (WHERE NOT ok)::int,
		    min(checked_at)
		FROM uptime_checks
		WHERE project_id = ANY($1)
		  AND checked_at > now() - $2::interval
		GROUP BY project_id
	`, ids, intervalString(window))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var total, failed int
		var oldest *time.Time
		if err := rows.Scan(&id, &total, &failed, &oldest); err != nil {
			return nil, err
		}
		s := &Stats{
			Total:   total,
			Failed:  failed,
			HasData: total > 0,
		}
		if total > 0 {
			s.Percent = float64(total-failed) * 100.0 / float64(total)
			windowH := int(window.Hours())
			if oldest != nil {
				actual := time.Since(*oldest).Hours()
				if int(actual) < windowH {
					windowH = int(actual)
					if windowH < 1 {
						windowH = 1
					}
				}
			}
			s.WindowH = windowH
		}
		out[id] = s
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// Fill in zero entries for ids without data so callers don't have to nil-check.
	for _, id := range ids {
		if _, ok := out[id]; !ok {
			out[id] = &Stats{HasData: false}
		}
	}
	return out, nil
}

// Point is one bucket in a latency time series.
type Point struct {
	Ts       time.Time `json:"ts"`
	P50      int       `json:"p50"`
	P95      int       `json:"p95"`
	Count    int       `json:"count"`
	Failures int       `json:"failures"`
}

// TimeSeries returns latency stats bucketed over `window`, one Point per
// `bucket` interval (default 5 minutes).
func TimeSeries(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID, window, bucket time.Duration) ([]Point, error) {
	if bucket <= 0 {
		bucket = 5 * time.Minute
	}
	bucketSec := int(bucket.Seconds())

	rows, err := pool.Query(ctx, `
		SELECT
		    to_timestamp(floor(extract(epoch FROM checked_at) / $3) * $3) AS bucket,
		    percentile_disc(0.5)  WITHIN GROUP (ORDER BY latency_ms)::int AS p50,
		    percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95,
		    count(*)::int AS total,
		    count(*) FILTER (WHERE NOT ok)::int AS failures
		FROM uptime_checks
		WHERE project_id = $1
		  AND checked_at > now() - $2::interval
		GROUP BY bucket
		ORDER BY bucket ASC
	`, projectID, intervalString(window), bucketSec)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Point, 0)
	for rows.Next() {
		var p Point
		if err := rows.Scan(&p.Ts, &p.P50, &p.P95, &p.Count, &p.Failures); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// LatencySummary is a snapshot for the project header card.
type LatencySummary struct {
	P50 int `json:"p50"`
	P95 int `json:"p95"`
	P99 int `json:"p99"`
}

// LatencyNow returns p50/p95/p99 across successful probes in the window.
func LatencyNow(ctx context.Context, pool *pgxpool.Pool, projectID uuid.UUID, window time.Duration) (*LatencySummary, error) {
	var s LatencySummary
	err := pool.QueryRow(ctx, `
		SELECT
		    coalesce(percentile_disc(0.5)  WITHIN GROUP (ORDER BY latency_ms)::int, 0),
		    coalesce(percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms)::int, 0),
		    coalesce(percentile_disc(0.99) WITHIN GROUP (ORDER BY latency_ms)::int, 0)
		FROM uptime_checks
		WHERE project_id = $1
		  AND checked_at > now() - $2::interval
		  AND ok = true
	`, projectID, intervalString(window)).Scan(&s.P50, &s.P95, &s.P99)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// Postgres interval string. We accept a duration so callers can pass
// '30 days', '24 hours', etc.
func intervalString(d time.Duration) string {
	secs := int(d.Seconds())
	if secs < 1 {
		secs = 1
	}
	return formatInterval(secs)
}

func formatInterval(seconds int) string {
	// Postgres interval input understands "N seconds".
	return itoa(seconds) + " seconds"
}

// tiny inline itoa to avoid pulling in strconv just for this.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
