package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahomsi0/opslens/backend/internal/ai"
)

type AIAPI struct {
	Pool *pgxpool.Pool
}

// Config tells the frontend whether to call /api/ai/chat or fall back
// to the canned client-side responses.
func (a *AIAPI) Config(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled": ai.Configured(),
	})
}

type chatReq struct {
	Messages  []ai.Message `json:"messages"`
	ProjectID string       `json:"projectId,omitempty"`
}

// Chat streams a Groq completion back over SSE. Each event is a JSON
// payload `{"delta": "..."}` plus a terminating `{"done": true}`.
func (a *AIAPI) Chat(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	if !ai.Configured() {
		writeErr(w, http.StatusServiceUnavailable, "AI is not configured on this server")
		return
	}

	var req chatReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if len(req.Messages) == 0 {
		writeErr(w, http.StatusBadRequest, "messages cannot be empty")
		return
	}

	// Build the focus-aware system prompt from real DB state.
	var projectID uuid.UUID
	if req.ProjectID != "" {
		if id, err := uuid.Parse(req.ProjectID); err == nil {
			projectID = id
		}
	}

	ctxBuild, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	sys, err := ai.BuildSystemPrompt(ctxBuild, a.Pool, projectID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not build context: "+err.Error())
		return
	}

	// Prepend system message.
	messages := make([]ai.Message, 0, len(req.Messages)+1)
	messages = append(messages, ai.Message{Role: "system", Content: sys})
	messages = append(messages, req.Messages...)

	// SSE headers.
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache, no-transform")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no") // hint to proxies (nginx etc.) not to buffer
	w.WriteHeader(http.StatusOK)

	flusher, _ := w.(http.Flusher)
	if flusher == nil {
		// Shouldn't happen in net/http, but bail clean if it does.
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	deltas := make(chan string, 16)
	streamCtx, streamCancel := context.WithCancel(r.Context())
	defer streamCancel()

	// Run Groq in a goroutine so we can fan-in to the SSE writer.
	errCh := make(chan error, 1)
	go func() {
		defer close(deltas)
		errCh <- ai.StreamChat(streamCtx, messages, deltas)
	}()

	writeEvent := func(payload any) bool {
		data, _ := json.Marshal(payload)
		if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
			return false
		}
		flusher.Flush()
		return true
	}

	for delta := range deltas {
		if !writeEvent(map[string]string{"delta": delta}) {
			return
		}
	}

	if err := <-errCh; err != nil {
		if errors.Is(err, context.Canceled) {
			return
		}
		writeEvent(map[string]string{"error": err.Error()})
		return
	}
	writeEvent(map[string]bool{"done": true})
}
