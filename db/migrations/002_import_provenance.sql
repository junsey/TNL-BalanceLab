BEGIN;
ALTER TABLE lab_records ADD COLUMN IF NOT EXISTS origin_id uuid;
ALTER TABLE lab_records ADD COLUMN IF NOT EXISTS origin_revision integer CHECK (origin_revision > 0);
COMMIT;
