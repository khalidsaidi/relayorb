ALTER TABLE jobs ADD COLUMN created_by_subject TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_env_created_by_subject ON jobs(env, created_by_subject);
