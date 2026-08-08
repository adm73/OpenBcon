-- Support idempotent imports from JSON funding-program catalogs.

ALTER TABLE funding_programs
  ADD COLUMN IF NOT EXISTS program_status text NOT NULL DEFAULT '';

ALTER TABLE funding_programs
  DROP CONSTRAINT IF EXISTS funding_programs_source_type_check;

ALTER TABLE funding_programs
  ADD CONSTRAINT funding_programs_source_type_check
  CHECK (source_type IN ('builtin', 'google-sheets', 'airtable', 'json-file', 'manual'));

CREATE UNIQUE INDEX IF NOT EXISTS funding_programs_workspace_source_record_unique_idx
  ON funding_programs (workspace_id, source_id, source_record_id)
  WHERE source_id IS NOT NULL AND source_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS funding_programs_program_status_idx
  ON funding_programs (workspace_id, program_status)
  WHERE program_status <> '';
