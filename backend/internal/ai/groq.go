// Groq client — uses Groq's OpenAI-compatible chat completions API
// with streaming. Returns a channel of text deltas so the HTTP handler
// can forward them straight to the browser over SSE.
package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	groqBase    = "https://api.groq.com/openai/v1"
	defaultModel = "llama-3.3-70b-versatile"
)

var ErrNotConfigured = errors.New("GROQ_API_KEY not set")

type Message struct {
	Role    string `json:"role"`    // 'system' | 'user' | 'assistant'
	Content string `json:"content"`
}

type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream"`
	Temperature float64   `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
}

// StreamChat sends messages to Groq and emits content deltas onto out.
// Closes out when the stream finishes. Returns once the upstream is done.
func StreamChat(ctx context.Context, messages []Message, out chan<- string) error {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return ErrNotConfigured
	}

	model := os.Getenv("GROQ_MODEL")
	if model == "" {
		model = defaultModel
	}

	body, err := json.Marshal(ChatRequest{
		Model:       model,
		Messages:    messages,
		Stream:      true,
		Temperature: 0.4,
		MaxTokens:   600,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", groqBase+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return fmt.Errorf("groq %s: %s", resp.Status, string(b))
	}

	reader := bufio.NewReader(resp.Body)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		line, err := reader.ReadString('\n')
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" || !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")
		if payload == "[DONE]" {
			return nil
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
				FinishReason string `json:"finish_reason"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
			continue
		}
		for _, c := range chunk.Choices {
			if c.Delta.Content != "" {
				out <- c.Delta.Content
			}
		}
	}
}

// Configured reports whether GROQ_API_KEY is available. Used by the
// /api/ai/config endpoint so the frontend can decide whether to call
// the real chat API or fall back to canned responses.
func Configured() bool {
	return os.Getenv("GROQ_API_KEY") != ""
}
