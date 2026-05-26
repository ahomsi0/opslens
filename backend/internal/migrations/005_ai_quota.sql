-- Log every AI chat completion so we can rate-limit per-user and globally.
-- One row per *successful* request; tracks prompt/completion sizes for
-- visibility. The frontend reads aggregate counts via /api/ai/quota.

CREATE TABLE IF NOT EXISTS ai_queries (
    id               BIGSERIAL PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    prompt_chars     INT NOT NULL DEFAULT 0,
    completion_chars INT NOT NULL DEFAULT 0,
    error            TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_queries_user_created
    ON ai_queries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_queries_created
    ON ai_queries (created_at DESC);
