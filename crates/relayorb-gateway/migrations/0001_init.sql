CREATE TABLE IF NOT EXISTS invocations (
  request_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  routed_to TEXT NOT NULL,
  req_canon_json TEXT NOT NULL,
  req_sha256 TEXT NOT NULL,
  res_json TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invocations_capability_id ON invocations(capability_id);
CREATE INDEX IF NOT EXISTS idx_invocations_created_at ON invocations(created_at);
