BEGIN;
ALTER TABLE lab_records DROP CONSTRAINT IF EXISTS lab_records_kind_check;
ALTER TABLE lab_records ADD CONSTRAINT lab_records_kind_check CHECK (kind IN ('weapon','armor','shield','creature','character','creation','module','ai','scenario','study','run','batch','settings'));
COMMIT;
