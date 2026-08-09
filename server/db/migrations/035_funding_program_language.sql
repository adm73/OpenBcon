-- Keep translated funding-program catalogs in the same table while allowing the
-- client to request one language at a time.

ALTER TABLE funding_programs
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en-CA';

UPDATE funding_programs
SET language = 'en-CA'
WHERE language IS NULL OR btrim(language) = '';

ALTER TABLE funding_programs
  DROP CONSTRAINT IF EXISTS funding_programs_language_check;

ALTER TABLE funding_programs
  ADD CONSTRAINT funding_programs_language_check
  CHECK (language IN ('en-CA', 'fr-CA', 'zh-CN'));

CREATE INDEX IF NOT EXISTS funding_programs_workspace_language_idx
  ON funding_programs (workspace_id, language, status, updated_at DESC);
