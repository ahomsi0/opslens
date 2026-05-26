-- Auth schema. Users sign up with email/password OR GitHub OAuth.
-- Sessions are server-side (no JWT) — secure HttpOnly cookies hold a
-- random token that maps to a row in `sessions`.

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    -- Nullable for OAuth-only users. Email/password users have a bcrypt hash.
    password_hash TEXT,
    -- Set for users who signed in via GitHub. Used to find-or-create on callback.
    github_id     BIGINT UNIQUE,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,        -- 32-byte random hex, prefixed 'sess_'
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_agent TEXT,
    ip         TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- Rename workspace_id → user_id on provider_connections. The column type
-- (uuid) is unchanged, but we drop NOT NULL so existing rows can be
-- 'orphaned' (user_id IS NULL) until the first signup claims them.
ALTER TABLE provider_connections RENAME COLUMN workspace_id TO user_id;
ALTER TABLE provider_connections ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE provider_connections DROP CONSTRAINT IF EXISTS provider_connections_workspace_id_fkey;

-- Existing rows had a fixed DefaultWorkspaceID. Null them out so the first
-- signup can claim them.
UPDATE provider_connections SET user_id = NULL;

-- Add the real foreign key once user_id may legitimately be NULL.
ALTER TABLE provider_connections
    ADD CONSTRAINT provider_connections_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Replace the old workspace index with a user index.
DROP INDEX IF EXISTS idx_provider_connections_workspace;
CREATE INDEX IF NOT EXISTS idx_provider_connections_user
    ON provider_connections (user_id);
