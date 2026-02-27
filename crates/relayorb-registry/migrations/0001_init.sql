CREATE TABLE IF NOT EXISTS capabilities (
  capability_id TEXT PRIMARY KEY,
  manifest_json TEXT NOT NULL,
  schema_hashes TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS instances (
  instance_id TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  region TEXT,
  last_heartbeat INTEGER NOT NULL,
  ttl_seconds INTEGER NOT NULL,
  stats_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instance_capabilities (
  instance_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  PRIMARY KEY (instance_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_instances_last_heartbeat ON instances(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_instance_capabilities_capability ON instance_capabilities(capability_id);
