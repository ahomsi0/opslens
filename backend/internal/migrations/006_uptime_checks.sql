-- Real uptime tracking. The prober writes one row per project per minute;
-- we compute uptime % at read time via a windowed count.

CREATE TABLE IF NOT EXISTS uptime_checks (
    id          BIGSERIAL PRIMARY KEY,
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    checked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ok          BOOLEAN NOT NULL,
    latency_ms  INT NOT NULL DEFAULT 0,
    status_code INT NOT NULL DEFAULT 0,
    error       TEXT
);

-- Hot path is "count(ok) over the last 30 days for project X" — index
-- supports the windowed scan without touching the heap.
CREATE INDEX IF NOT EXISTS idx_uptime_checks_project_time
    ON uptime_checks (project_id, checked_at DESC);

-- For tidy housekeeping: drop checks older than 90 days. Cron not wired
-- yet; can be a manual cleanup or a future scheduled job.
CREATE INDEX IF NOT EXISTS idx_uptime_checks_old
    ON uptime_checks (checked_at);
