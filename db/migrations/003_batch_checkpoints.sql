BEGIN;
CREATE TABLE IF NOT EXISTS lab_batch_jobs (
  id uuid PRIMARY KEY,
  alias text NOT NULL CHECK (length(alias) BETWEEN 1 AND 60),
  plan_hash text NOT NULL CHECK (length(plan_hash) = 64),
  plan jsonb NOT NULL,
  requested integer NOT NULL CHECK (requested BETWEEN 1 AND 10000),
  next_index integer NOT NULL DEFAULT 0 CHECK (next_index BETWEEN 0 AND requested),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','canceled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lab_batch_checkpoints (
  job_id uuid NOT NULL REFERENCES lab_batch_jobs(id),
  first_index integer NOT NULL CHECK (first_index >= 0),
  end_index integer NOT NULL CHECK (end_index > first_index),
  payload_hash text NOT NULL CHECK (length(payload_hash) = 64),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id,first_index)
);
COMMIT;
