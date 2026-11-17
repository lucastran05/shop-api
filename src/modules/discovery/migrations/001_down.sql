-- Explicit rollback only. Never run during application startup.
DROP TABLE IF EXISTS discovery_interactions;
DROP TABLE IF EXISTS discovery_occasions;
DROP TABLE IF EXISTS discovery_preferences;
