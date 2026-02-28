CREATE TABLE IF NOT EXISTS jobs (
  env TEXT NOT NULL,
  job_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  caller_agent_id TEXT NOT NULL,
  caller_role TEXT NOT NULL,
  budget_key TEXT,
  payload_json TEXT NOT NULL,
  payload_canon_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  callback_url TEXT,
  max_run_ms INTEGER,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  locked_by TEXT,
  locked_at INTEGER,
  trace_id TEXT,
  result_json TEXT,
  error_json TEXT,
  available_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (env, job_id),
  UNIQUE (env, request_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_env_state_available ON jobs(env, state, available_at);
CREATE INDEX IF NOT EXISTS idx_jobs_env_created_at ON jobs(env, created_at);
