// Package uptime probes monitored projects' domains and stores results.
// One goroutine ticks every 60 seconds, fans out HTTP HEAD requests to
// every project with a non-empty domain, and inserts rows into
// uptime_checks. The dashboard reads from that table to compute real %.
package uptime

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	tickInterval     = 60 * time.Second
	requestTimeout   = 10 * time.Second
	concurrencyLimit = 6 // probe up to N domains in parallel
)

type Prober struct {
	pool   *pgxpool.Pool
	client *http.Client
}

func NewProber(pool *pgxpool.Pool) *Prober {
	return &Prober{
		pool: pool,
		client: &http.Client{
			Timeout: requestTimeout,
			// Don't follow redirects — many SaaS hosts redirect to a marketing
			// page (e.g. neon.tech → docs). The redirect itself is fine evidence
			// the host is up. Treat 3xx as healthy.
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

// Run is blocking — call as `go p.Run(ctx)`.
func (p *Prober) Run(ctx context.Context) {
	// Brief warmup so we don't probe the moment the server is launching.
	time.Sleep(5 * time.Second)
	p.tick(ctx)
	t := time.NewTicker(tickInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			p.tick(ctx)
		}
	}
}

type probeTarget struct {
	ProjectID uuid.UUID
	Domain    string
}

func (p *Prober) tick(ctx context.Context) {
	targets, err := p.loadTargets(ctx)
	if err != nil {
		log.Printf("uptime: load targets: %v", err)
		return
	}
	if len(targets) == 0 {
		return
	}

	// Bounded parallelism. With 50+ projects we don't want to open 50 sockets.
	sem := make(chan struct{}, concurrencyLimit)
	var wg sync.WaitGroup
	for _, t := range targets {
		wg.Add(1)
		sem <- struct{}{}
		go func(t probeTarget) {
			defer wg.Done()
			defer func() { <-sem }()
			p.probe(ctx, t)
		}(t)
	}
	wg.Wait()
}

func (p *Prober) loadTargets(ctx context.Context) ([]probeTarget, error) {
	// Skip projects with empty / clearly-internal domains.
	rows, err := p.pool.Query(ctx, `
		SELECT id, domain
		FROM projects
		WHERE domain != ''
		  AND domain NOT ILIKE '%.internal'
		  AND domain NOT ILIKE 'worker.%'
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []probeTarget
	for rows.Next() {
		var t probeTarget
		if err := rows.Scan(&t.ProjectID, &t.Domain); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (p *Prober) probe(ctx context.Context, t probeTarget) {
	url := normalizeURL(t.Domain)
	start := time.Now()

	req, err := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
	if err != nil {
		p.record(ctx, t.ProjectID, false, 0, 0, err.Error())
		return
	}
	req.Header.Set("User-Agent", "Opslens-Uptime/1.0 (+https://opslens-ah.vercel.app)")

	resp, err := p.client.Do(req)
	if err != nil {
		// HEAD might be blocked — retry with GET. Some hosts return 405 on HEAD.
		// We do a short GET with body draining suppressed.
		if maybeHeadBlocked(err) {
			resp, err = p.fallbackGet(ctx, url)
		}
		if err != nil {
			p.record(ctx, t.ProjectID, false, int(time.Since(start).Milliseconds()), 0, friendlyError(err))
			return
		}
	}
	defer resp.Body.Close()

	// Method-not-allowed on HEAD → retry with GET. Treat as healthy if GET works.
	if resp.StatusCode == http.StatusMethodNotAllowed {
		resp.Body.Close()
		resp, err = p.fallbackGet(ctx, url)
		if err != nil {
			p.record(ctx, t.ProjectID, false, int(time.Since(start).Milliseconds()), 0, friendlyError(err))
			return
		}
		defer resp.Body.Close()
	}

	latency := int(time.Since(start).Milliseconds())
	ok := resp.StatusCode < 500
	errMsg := ""
	if !ok {
		errMsg = resp.Status
	}
	p.record(ctx, t.ProjectID, ok, latency, resp.StatusCode, errMsg)
}

func (p *Prober) fallbackGet(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Opslens-Uptime/1.0")
	return p.client.Do(req)
}

func (p *Prober) record(ctx context.Context, projectID uuid.UUID, ok bool, latency, status int, errMsg string) {
	var errCol *string
	if errMsg != "" {
		errCol = &errMsg
	}
	_, _ = p.pool.Exec(ctx, `
		INSERT INTO uptime_checks (project_id, ok, latency_ms, status_code, error)
		VALUES ($1, $2, $3, $4, $5)
	`, projectID, ok, latency, status, errCol)
}

func normalizeURL(domain string) string {
	d := strings.TrimSpace(domain)
	if strings.HasPrefix(d, "http://") || strings.HasPrefix(d, "https://") {
		return d
	}
	return "https://" + d
}

func maybeHeadBlocked(err error) bool {
	// A few hosts close the connection on HEAD without sending a response.
	// Retrying with GET often works.
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	if strings.Contains(err.Error(), "EOF") {
		return true
	}
	return false
}

func friendlyError(err error) string {
	if err == nil {
		return ""
	}
	s := err.Error()
	if len(s) > 200 {
		return s[:200]
	}
	return s
}
