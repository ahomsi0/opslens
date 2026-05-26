// Rate limiting for the AI assistant. Three caps stack:
//
//   1. Per-user, per-minute  — burst protection (default 5 / 60s)
//   2. Per-user, per-day     — main quota   (default 30 / 24h)
//   3. Global, per-day       — wallet safety (default 200 / 24h)
//
// Plus a hard message-length cap to keep prompt tokens bounded.
//
// Anything can be overridden via env vars at startup.
package ai

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Limits struct {
	PerUserPerMinute int
	PerUserPerDay    int
	GlobalPerDay     int
	MaxPromptChars   int
}

func DefaultLimits() Limits {
	return Limits{
		PerUserPerMinute: getenvInt("AI_PER_MINUTE", 5),
		PerUserPerDay:    getenvInt("AI_PER_DAY", 30),
		GlobalPerDay:     getenvInt("AI_GLOBAL_DAILY", 200),
		MaxPromptChars:   getenvInt("AI_MAX_PROMPT_CHARS", 4000),
	}
}

// Usage is what the UI shows in the AI panel footer.
type Usage struct {
	Limits           Limits `json:"limits"`
	UsedTodayUser    int    `json:"usedTodayUser"`
	UsedThisMinute   int    `json:"usedThisMinute"`
	UsedTodayGlobal  int    `json:"usedTodayGlobal"`
	RemainingToday   int    `json:"remainingToday"`
}

func GetUsage(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, limits Limits) (*Usage, error) {
	var todayUser, lastMin, todayGlobal int
	err := pool.QueryRow(ctx, `
		SELECT
		    (SELECT count(*) FROM ai_queries
		         WHERE user_id = $1 AND created_at > now() - interval '24 hours'),
		    (SELECT count(*) FROM ai_queries
		         WHERE user_id = $1 AND created_at > now() - interval '1 minute'),
		    (SELECT count(*) FROM ai_queries
		         WHERE created_at > now() - interval '24 hours')
	`, userID).Scan(&todayUser, &lastMin, &todayGlobal)
	if err != nil {
		return nil, err
	}
	remaining := limits.PerUserPerDay - todayUser
	if remaining < 0 {
		remaining = 0
	}
	return &Usage{
		Limits:          limits,
		UsedTodayUser:   todayUser,
		UsedThisMinute:  lastMin,
		UsedTodayGlobal: todayGlobal,
		RemainingToday:  remaining,
	}, nil
}

// Limit errors. Distinguished so the HTTP handler can give a useful message.
var (
	ErrPromptTooLong     = errors.New("prompt exceeds max length")
	ErrTooManyPerMinute  = errors.New("too many AI requests per minute")
	ErrTooManyPerDay     = errors.New("AI daily quota reached")
	ErrGlobalQuotaHit    = errors.New("global AI quota reached for today, try again tomorrow")
)

// CheckAllowed runs every limit check and returns an error if any fails.
// Caller should treat any error as 429 Too Many Requests.
func CheckAllowed(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, limits Limits, totalPromptChars int) error {
	if totalPromptChars > limits.MaxPromptChars {
		return fmt.Errorf("%w (max %d chars, got %d)", ErrPromptTooLong, limits.MaxPromptChars, totalPromptChars)
	}
	u, err := GetUsage(ctx, pool, userID, limits)
	if err != nil {
		return err
	}
	if u.UsedThisMinute >= limits.PerUserPerMinute {
		return fmt.Errorf("%w (%d / %d in the last minute)", ErrTooManyPerMinute, u.UsedThisMinute, limits.PerUserPerMinute)
	}
	if u.UsedTodayUser >= limits.PerUserPerDay {
		return fmt.Errorf("%w (%d / %d today)", ErrTooManyPerDay, u.UsedTodayUser, limits.PerUserPerDay)
	}
	if u.UsedTodayGlobal >= limits.GlobalPerDay {
		return ErrGlobalQuotaHit
	}
	return nil
}

// RecordQuery inserts an ai_queries row. Best-effort — we don't fail the
// stream if the insert errors (already-streamed bytes can't be unstreamed).
func RecordQuery(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, promptChars, completionChars int, errMsg string) {
	var e *string
	if errMsg != "" {
		e = &errMsg
	}
	_, _ = pool.Exec(ctx, `
		INSERT INTO ai_queries (user_id, prompt_chars, completion_chars, error)
		VALUES ($1, $2, $3, $4)
	`, userID, promptChars, completionChars, e)
}

func getenvInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
