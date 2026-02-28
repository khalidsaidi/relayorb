CREATE TABLE IF NOT EXISTS invocations_v2 (
  env TEXT NOT NULL,
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  routed_to TEXT,
  req_canon_json TEXT NOT NULL,
  req_sha256 TEXT NOT NULL,
  res_json TEXT,
  error_json TEXT,
  status TEXT NOT NULL,
  retries INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (env, request_id)
);

INSERT INTO invocations_v2 (
  env,
  request_id,
  request_hash,
  state,
  trace_id,
  agent_id,
  capability_id,
  routed_to,
  req_canon_json,
  req_sha256,
  res_json,
  error_json,
  status,
  retries,
  latency_ms,
  created_at,
  updated_at
)
SELECT
  'dev' AS env,
  request_id,
  req_sha256 AS request_hash,
  'completed' AS state,
  trace_id,
  agent_id,
  capability_id,
  routed_to,
  req_canon_json,
  req_sha256,
  res_json,
  NULL AS error_json,
  status,
  0 AS retries,
  latency_ms,
  created_at,
  created_at AS updated_at
FROM invocations;

DROP TABLE invocations;
ALTER TABLE invocations_v2 RENAME TO invocations;

CREATE INDEX IF NOT EXISTS idx_invocations_env_capability_id ON invocations(env, capability_id);
CREATE INDEX IF NOT EXISTS idx_invocations_env_created_at ON invocations(env, created_at);
