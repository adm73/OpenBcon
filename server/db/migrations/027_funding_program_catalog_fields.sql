-- Add the synchronized funding-program catalog fields and its public identifier.

ALTER TABLE funding_programs
  ADD COLUMN IF NOT EXISTS pid text,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deadline text NOT NULL DEFAULT 'Open',
  ADD COLUMN IF NOT EXISTS eligibility text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS eligible_uses text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_company_types text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS required_evidence text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS match_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS source_record_id text,
  ADD COLUMN IF NOT EXISTS source_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS record_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

UPDATE funding_programs
SET
  source_type = CASE
    WHEN source_type IS NULL OR btrim(source_type) = '' THEN 'manual'
    ELSE source_type
  END,
  status = CASE
    WHEN status IS NULL OR btrim(status) = '' THEN 'active'
    ELSE status
  END,
  deadline = CASE
    WHEN deadline IS NULL OR btrim(deadline) = '' THEN 'Open'
    ELSE deadline
  END,
  match_score = LEAST(100, GREATEST(0, match_score));

DO $$
DECLARE
  row_record record;
  candidate text;
BEGIN
  FOR row_record IN
    SELECT id
    FROM funding_programs
    WHERE pid IS NULL OR btrim(pid) = ''
  LOOP
    LOOP
      candidate := (
        1000000000000000::bigint
        + floor(random() * 9000000000000000)::bigint
      )::text;

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM funding_programs
        WHERE pid = candidate
      );
    END LOOP;

    UPDATE funding_programs
    SET pid = candidate
    WHERE id = row_record.id;
  END LOOP;
END;
$$;

ALTER TABLE funding_programs
  ALTER COLUMN pid SET NOT NULL;

ALTER TABLE funding_programs
  ADD CONSTRAINT funding_programs_pid_format_check
  CHECK (pid ~ '^[0-9]{16}$');

ALTER TABLE funding_programs
  ADD CONSTRAINT funding_programs_match_score_check
  CHECK (match_score >= 0 AND match_score <= 100);

ALTER TABLE funding_programs
  ADD CONSTRAINT funding_programs_source_type_check
  CHECK (source_type IN ('builtin', 'google-sheets', 'airtable', 'manual'));

ALTER TABLE funding_programs
  ADD CONSTRAINT funding_programs_status_check
  CHECK (status IN ('active', 'archived'));

CREATE UNIQUE INDEX IF NOT EXISTS funding_programs_pid_unique_idx
  ON funding_programs (pid);

CREATE OR REPLACE FUNCTION generate_funding_program_pid()
RETURNS trigger AS $$
DECLARE
  candidate text;
BEGIN
  IF NEW.pid IS NULL OR btrim(NEW.pid) = '' THEN
    LOOP
      candidate := (
        1000000000000000::bigint
        + floor(random() * 9000000000000000)::bigint
      )::text;

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM funding_programs
        WHERE pid = candidate
      );
    END LOOP;

    NEW.pid = candidate;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS funding_programs_generate_pid ON funding_programs;
CREATE TRIGGER funding_programs_generate_pid
BEFORE INSERT ON funding_programs
FOR EACH ROW EXECUTE FUNCTION generate_funding_program_pid();

CREATE INDEX IF NOT EXISTS funding_programs_source_record_idx
  ON funding_programs (source_id, source_record_id)
  WHERE source_id IS NOT NULL AND source_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS funding_programs_status_idx
  ON funding_programs (workspace_id, status, updated_at DESC);
