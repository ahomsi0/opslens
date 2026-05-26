-- Docker connections are agent-based, not API-based. Each connection gets
-- a unique heartbeat token the user installs on their Docker host.
-- We reuse provider_connections for the row itself; the heartbeat token is
-- stored in encrypted_token like any other secret. The host name comes
-- from the agent's heartbeat payload and lives on the project rows.
--
-- Nothing to add here yet — provider_connections already supports this
-- shape. Migration kept for ordering / future Docker-specific schema.
SELECT 1;
