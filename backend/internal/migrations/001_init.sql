CREATE TABLE IF NOT EXISTS projects (
    id          UUID PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    provider    TEXT NOT NULL,
    environment TEXT NOT NULL,
    region      TEXT NOT NULL,
    repo_url    TEXT NOT NULL,
    domain      TEXT NOT NULL,
    status      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployments (
    id           UUID PRIMARY KEY,
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status       TEXT NOT NULL,
    commit_sha   TEXT NOT NULL,
    commit_msg   TEXT NOT NULL,
    author       TEXT NOT NULL,
    branch       TEXT NOT NULL,
    duration_ms  INT  NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deployments_project_created
    ON deployments(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS logs (
    id         BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    level      TEXT NOT NULL,
    source     TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_project_created
    ON logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_project_level
    ON logs(project_id, level);
