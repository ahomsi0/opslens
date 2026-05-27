-- Incidents: every time a project's probe state flips from healthy to
-- unhealthy (and stays so for a few minutes), we open an incident row.
-- When it recovers, we set ended_at + duration_ms.

CREATE TABLE IF NOT EXISTS incidents (
    id            UUID PRIMARY KEY,
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at      TIMESTAMPTZ,
    duration_ms   BIGINT NOT NULL DEFAULT 0,
    severity      TEXT NOT NULL DEFAULT 'down', -- 'down' | 'degraded'
    -- Snapshot of what we knew at incident open time. Probably an HTTP
    -- status code + an error string from the first failing check.
    first_status  INT,
    first_error   TEXT,
    -- For ranking / sorting in the UI.
    last_failure_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incidents_project_started
    ON incidents (project_id, started_at DESC);

-- Used to find "the currently-open incident for this project". Partial index
-- to keep it tight — most rows are closed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_open_per_project
    ON incidents (project_id)
    WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_user_started
    ON incidents (user_id, started_at DESC);

-- SSL info captured by the prober on each check. Nullable because not every
-- probe inspects certs (we sample once an hour to keep overhead low).
ALTER TABLE uptime_checks
    ADD COLUMN IF NOT EXISTS ssl_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ssl_issuer     TEXT;
