package metrics

import (
	"context"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/ahomsi0/opslens/backend/internal/models"
)

// Hub fan-outs metric frames to per-project subscribers.
type Hub struct {
	mu       sync.RWMutex
	channels map[uuid.UUID][]chan models.MetricFrame
	buffers  map[uuid.UUID][]models.MetricFrame // last 5 minutes per project
}

func NewHub() *Hub {
	return &Hub{
		channels: make(map[uuid.UUID][]chan models.MetricFrame),
		buffers:  make(map[uuid.UUID][]models.MetricFrame),
	}
}

// Subscribe returns a channel that receives frames for the given project,
// pre-loaded with the most recent buffer. Caller must call unsub when done.
func (h *Hub) Subscribe(projectID uuid.UUID) (<-chan models.MetricFrame, []models.MetricFrame, func()) {
	ch := make(chan models.MetricFrame, 64)
	h.mu.Lock()
	h.channels[projectID] = append(h.channels[projectID], ch)
	buf := append([]models.MetricFrame(nil), h.buffers[projectID]...)
	h.mu.Unlock()
	unsub := func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		subs := h.channels[projectID]
		for i, c := range subs {
			if c == ch {
				h.channels[projectID] = append(subs[:i], subs[i+1:]...)
				close(c)
				return
			}
		}
	}
	return ch, buf, unsub
}

func (h *Hub) publish(projectID uuid.UUID, f models.MetricFrame) {
	h.mu.Lock()
	// append to ring buffer (cap 300 = 5 min @ 1Hz)
	buf := h.buffers[projectID]
	buf = append(buf, f)
	if len(buf) > 300 {
		buf = buf[len(buf)-300:]
	}
	h.buffers[projectID] = buf
	subs := h.channels[projectID]
	h.mu.Unlock()

	for _, ch := range subs {
		select {
		case ch <- f:
		default:
			// drop if subscriber slow
		}
	}
}

// Snapshot returns the most recent buffer for the project (latency sparkline source).
func (h *Hub) Snapshot(projectID uuid.UUID) []models.MetricFrame {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return append([]models.MetricFrame(nil), h.buffers[projectID]...)
}

// personality derived from project id for deterministic-feeling metrics
type personality struct {
	baseCPU    float64
	baseMem    float64
	baseLat    float64
	noise      float64
	spikeProb  float64
	statusBias string
}

func personalityFor(id uuid.UUID, status string) personality {
	seed := int64(0)
	for _, b := range id[:8] {
		seed = seed<<8 | int64(b)
	}
	r := rand.New(rand.NewSource(seed))
	p := personality{
		baseCPU:    18 + r.Float64()*30,
		baseMem:    40 + r.Float64()*25,
		baseLat:    80 + r.Float64()*120,
		noise:      4 + r.Float64()*6,
		spikeProb:  0.02 + r.Float64()*0.03,
		statusBias: status,
	}
	if status == "degraded" {
		p.baseLat *= 2.2
		p.noise *= 1.6
		p.spikeProb = 0.12
	}
	if status == "down" {
		p.baseLat *= 4
		p.noise *= 2
		p.spikeProb = 0.25
	}
	return p
}

type Generator struct {
	hub *Hub
}

func NewGenerator(hub *Hub) *Generator { return &Generator{hub: hub} }

// Start launches a goroutine per project that emits 1 frame/sec.
func (g *Generator) Start(ctx context.Context, projects []models.Project) {
	for _, p := range projects {
		go g.run(ctx, p)
	}
}

func (g *Generator) run(ctx context.Context, p models.Project) {
	pers := personalityFor(p.ID, p.Status)
	r := rand.New(rand.NewSource(time.Now().UnixNano() ^ int64(p.ID[0])))
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	phase := 0.0

	for {
		select {
		case <-ctx.Done():
			return
		case t := <-ticker.C:
			phase += 0.08

			cpu := pers.baseCPU + math.Sin(phase)*4 + (r.Float64()-0.5)*pers.noise
			mem := pers.baseMem + math.Sin(phase*0.3)*3 + (r.Float64()-0.5)*pers.noise*0.5
			lat := pers.baseLat + math.Sin(phase*0.7)*15 + (r.Float64()-0.5)*pers.noise*3
			rps := 80 + math.Sin(phase*0.5)*40 + r.Float64()*30

			if r.Float64() < pers.spikeProb {
				cpu += 25 + r.Float64()*30
				lat += 200 + r.Float64()*400
			}

			frame := models.MetricFrame{
				Type:      "metric",
				ProjectID: p.ID,
				Ts:        t.UTC(),
				CPU:       clamp(cpu, 1, 99),
				Memory:    clamp(mem, 5, 96),
				NetIn:     clamp(20+r.Float64()*60+rps*0.4, 0, 500),
				NetOut:    clamp(15+r.Float64()*45+rps*0.3, 0, 500),
				LatencyMs: clamp(lat, 8, 5000),
				RPS:       clamp(rps, 0, 5000),
				Status:    pers.statusBias,
			}
			g.hub.publish(p.ID, frame)
		}
	}
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
