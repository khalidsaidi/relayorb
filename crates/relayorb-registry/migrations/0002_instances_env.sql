ALTER TABLE instances ADD COLUMN service_name TEXT;
ALTER TABLE instances ADD COLUMN env TEXT NOT NULL DEFAULT 'dev';

CREATE INDEX IF NOT EXISTS idx_instances_env ON instances(env);
