// Package providers ties the per-provider sync routines into a single
// background loop. It runs in its own goroutine, started from main.go, and
// re-syncs every connection on a fixed cadence.
package providers

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahomsi0/opslens/backend/internal/crypto"
	"github.com/ahomsi0/opslens/backend/internal/db"
	"github.com/ahomsi0/opslens/backend/internal/providers/neon"
	"github.com/ahomsi0/opslens/backend/internal/providers/railway"
	"github.com/ahomsi0/opslens/backend/internal/providers/render"
	"github.com/ahomsi0/opslens/backend/internal/providers/supabase"
	"github.com/ahomsi0/opslens/backend/internal/providers/uptimerobot"
	"github.com/ahomsi0/opslens/backend/internal/providers/vercel"
)

const defaultInterval = 30 * time.Second

type Poller struct {
	pool     *pgxpool.Pool
	sealer   *crypto.Sealer
	interval time.Duration
	mu       sync.Mutex
	syncing  map[string]bool // connectionID -> true if a sync is currently running
}

func NewPoller(pool *pgxpool.Pool, sealer *crypto.Sealer) *Poller {
	return &Poller{
		pool:     pool,
		sealer:   sealer,
		interval: defaultInterval,
		syncing:  map[string]bool{},
	}
}

// Run is blocking — call from `go p.Run(ctx)`.
func (p *Poller) Run(ctx context.Context) {
	// One immediate tick on boot so newly-added connections aren't waiting up to 30s.
	p.tick(ctx)
	t := time.NewTicker(p.interval)
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

func (p *Poller) tick(ctx context.Context) {
	conns, err := db.ListAllConnectionsWithTokens(ctx, p.pool)
	if err != nil {
		log.Printf("poller: list connections: %v", err)
		return
	}
	for _, c := range conns {
		c := c
		go p.syncOne(ctx, c)
	}
}

// SyncNow runs a sync for a single connection inline. Used right after
// a user adds a new connection so they don't have to wait for the next tick.
func (p *Poller) SyncNow(ctx context.Context, connectionID string) error {
	conns, err := db.ListAllConnectionsWithTokens(ctx, p.pool)
	if err != nil {
		return err
	}
	for _, c := range conns {
		if c.ID.String() == connectionID {
			p.syncOne(ctx, c)
			return nil
		}
	}
	return errors.New("connection not found")
}

func (p *Poller) syncOne(ctx context.Context, c db.ConnectionWithToken) {
	id := c.ID.String()
	p.mu.Lock()
	if p.syncing[id] {
		p.mu.Unlock()
		return // another sync still in flight; skip this tick
	}
	p.syncing[id] = true
	p.mu.Unlock()
	defer func() {
		p.mu.Lock()
		delete(p.syncing, id)
		p.mu.Unlock()
	}()

	token, err := p.sealer.DecryptString(c.EncryptedToken)
	if err != nil {
		log.Printf("poller: decrypt token for %s: %v", id, err)
		db.RecordSyncError(ctx, p.pool, c.ID, "could not decrypt token")
		return
	}

	syncCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	type syncFn func(context.Context, *pgxpool.Pool, uuid.UUID, string) (int, error)
	dispatch := map[string]syncFn{
		"vercel":      vercel.Sync,
		"render":      render.Sync,
		"neon":        neon.Sync,
		"supabase":    supabase.Sync,
		"railway":     railway.Sync,
		"uptimerobot": uptimerobot.Sync,
	}
	fn, ok := dispatch[c.Provider]
	if !ok {
		// Docker uses a push (heartbeat) model, no poller sync.
		if c.Provider != "docker" {
			log.Printf("poller: unknown provider %q for connection %s", c.Provider, id)
		}
		return
	}
	n, err := fn(syncCtx, p.pool, c.ID, token)
	if err != nil {
		log.Printf("poller: %s sync %s: %v", c.Provider, id, err)
		db.RecordSyncError(ctx, p.pool, c.ID, err.Error())
		return
	}
	log.Printf("poller: %s sync %s OK (%d projects)", c.Provider, c.Name, n)
}
