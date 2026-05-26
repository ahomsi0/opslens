-- Provider connections store encrypted API tokens for each connected service.
-- workspace_id is a placeholder for now (single-workspace, hardcoded UUID);
-- once we add real auth + multi-tenancy this becomes a real foreign key.
CREATE TABLE IF NOT EXISTS provider_connections (
    id              UUID PRIMARY KEY,
    workspace_id    UUID NOT NULL,
    provider        TEXT NOT NULL,                          -- 'vercel', 'render', 'neon', ...
    name            TEXT NOT NULL,                          -- user-supplied label (e.g. 'Personal account')
    account_label   TEXT,                                   -- pulled from provider on validate (e.g. vercel username)
    encrypted_token BYTEA NOT NULL,                         -- AES-GCM ciphertext (nonce prepended)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_synced_at  TIMESTAMPTZ,
    last_error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_provider_connections_workspace
    ON provider_connections(workspace_id);

-- Tag every project with its source. 'demo' = seeded; otherwise the provider name.
-- external_id is the provider's own id (e.g. Vercel's 'prj_xxx') so re-syncs upsert
-- instead of duplicating.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'demo',
    ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES provider_connections(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS external_id TEXT,
    ADD COLUMN IF NOT EXISTS live_metrics BOOLEAN NOT NULL DEFAULT TRUE;

-- A project is uniquely identified within a connection by its external id.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_projects_connection_external
    ON projects(connection_id, external_id)
    WHERE connection_id IS NOT NULL;

-- Deployments may also come from a real provider — link them to the same external id space.
ALTER TABLE deployments
    ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_deployments_external
    ON deployments(project_id, external_id)
    WHERE external_id IS NOT NULL;

-- The original schema had projects.slug UNIQUE which doesn't survive multi-source
-- data (two Vercel users could both have a "web" project). Drop the constraint —
-- we now identify projects by (connection_id, external_id) or by primary key.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_slug_key;
