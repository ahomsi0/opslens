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
	"github.com/ahomsi0/opslens/backend/internal/auth"
)

type AIAPI struct {
	Pool   *pgxpool.Pool
	Limits ai.Limits
}

// Config tells the frontend whether to call /api/ai/chat or fall back
// to the canned client-side responses.
func (a *AIAPI) Config(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled": ai.Configured(),
		"limits":  a.Limits,
	})
}

// Quota — current user's usage and what's left for the day.
func (a *AIAPI) Quota(w http.ResponseWriter, r *http.Request) {
	userID := auth.MustUser(r.Context())
	usage, err := ai.GetUsage(r.Context(), a.Pool, userID, a.Limits)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, usage)
}

type chatReq struct {
	Messages  []ai.Message `json:"messages"`
	ProjectID string       `json:"projectId,omitempty"`
}

// Chat streams a Groq completion back over SSE. Each event is a JSON
// payload `{"delta": "..."}` plus a terminating `{"done": true}`.
//
// Rate-limited per-user (per minute + per day) and globally (per day)
// before any token is sent to Groq.
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

	userID := auth.MustUser(r.Context())

	// Cap check — message length + the three rate limits. Reject with 429
	// before we open a Groq stream.
	totalPromptChars := 0
	for _, m := range req.Messages {
		totalPromptChars += len(m.Content)
	}
	if err := ai.CheckAllowed(r.Context(), a.Pool, userID, a.Limits, totalPromptChars); err != nil {
		status := http.StatusTooManyRequests
		if errors.Is(err, ai.ErrPromptTooLong) {
			status = http.StatusRequestEntityTooLarge
		}
		writeErr(w, status, err.Error())
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
	sys, err := ai.BuildSystemPrompt(ctxBuild, a.Pool, userID, projectID)
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
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	deltas := make(chan string, 16)
	streamCtx, streamCancel := context.WithCancel(r.Context())
	defer streamCancel()

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

	completionChars := 0
	for delta := range deltas {
		completionChars += len(delta)
		if !writeEvent(map[string]string{"delta": delta}) {
			return
		}
	}

	streamErr := <-errCh

	// Record the query whether it succeeded or not, so quota counts cover
	// failed (but billed) requests too. Best-effort: errors here are ignored.
	go func() {
		bg, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		errMsg := ""
		if streamErr != nil && !errors.Is(streamErr, context.Canceled) {
			errMsg = streamErr.Error()
		}
		ai.RecordQuery(bg, a.Pool, userID, totalPromptChars, completionChars, errMsg)
	}()

	if streamErr != nil {
		if errors.Is(streamErr, context.Canceled) {
			return
		}
		writeEvent(map[string]string{"error": streamErr.Error()})
		return
	}
	writeEvent(map[string]bool{"done": true})
}
