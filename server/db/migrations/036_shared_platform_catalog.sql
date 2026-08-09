-- Funding programs are platform catalog records shared by Test and Live.
-- Applications remain mode-local, so their program reference is validated by
-- the application service against the shared catalog instead of a cross-database FK.
ALTER TABLE IF EXISTS applications
  DROP CONSTRAINT IF EXISTS applications_funding_program_id_fkey;

ALTER TABLE IF EXISTS funding_packages
  DROP CONSTRAINT IF EXISTS funding_packages_funding_program_id_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS funding_programs_shared_source_record_unique_idx
  ON funding_programs (source_id, source_record_id)
  WHERE source_id IS NOT NULL AND source_record_id IS NOT NULL;
