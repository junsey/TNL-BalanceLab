BEGIN;
CREATE TABLE IF NOT EXISTS lab_records (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('weapon','armor','shield','creature','character','module','ai','scenario','study','run','batch','settings')),
  current_revision integer NOT NULL CHECK (current_revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lab_revisions (
  record_id uuid NOT NULL REFERENCES lab_records(id),
  revision integer NOT NULL CHECK (revision > 0),
  alias text NOT NULL CHECK (length(alias) BETWEEN 1 AND 60),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (record_id, revision)
);
CREATE INDEX IF NOT EXISTS lab_records_kind_id ON lab_records (kind,id);
COMMIT;
