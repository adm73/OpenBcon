-- Funding programs are platform catalog records shared by Test and Live.
-- Applications remain mode-local, so their program reference is validated by
-- the application service against the shared catalog instead of a cross-database FK.
ALTER TABLE IF EXISTS applications
  DROP CONSTRAINT IF EXISTS applications_funding_program_id_fkey;

ALTER TABLE IF EXISTS funding_packages
  DROP CONSTRAINT IF EXISTS funding_packages_funding_program_id_fkey;

-- Older seeds/imports created workspace-scoped copies before the catalog became
-- shared. Keep the newest shared copy as the canonical record and retarget any
-- existing application/package references before removing duplicate rows.
DO $$
BEGIN
  IF to_regclass('public.applications') IS NOT NULL THEN
    WITH ranked AS (
      SELECT
        id,
        first_value(id) OVER (
          PARTITION BY source_id, source_record_id
          ORDER BY workspace_id NULLS FIRST, updated_at DESC, id
        ) AS canonical_id
      FROM funding_programs
      WHERE source_id IS NOT NULL AND source_record_id IS NOT NULL
    )
    UPDATE applications
    SET funding_program_id = ranked.canonical_id
    FROM ranked
    WHERE applications.funding_program_id = ranked.id
      AND ranked.id <> ranked.canonical_id;
  END IF;

  IF to_regclass('public.funding_packages') IS NOT NULL THEN
    WITH ranked AS (
      SELECT
        id,
        first_value(id) OVER (
          PARTITION BY source_id, source_record_id
          ORDER BY workspace_id NULLS FIRST, updated_at DESC, id
        ) AS canonical_id
      FROM funding_programs
      WHERE source_id IS NOT NULL AND source_record_id IS NOT NULL
    )
    UPDATE funding_packages
    SET funding_program_id = ranked.canonical_id
    FROM ranked
    WHERE funding_packages.funding_program_id = ranked.id
      AND ranked.id <> ranked.canonical_id;
  END IF;
END $$;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY source_id, source_record_id
      ORDER BY workspace_id NULLS FIRST, updated_at DESC, id
    ) AS duplicate_rank
  FROM funding_programs
  WHERE source_id IS NOT NULL AND source_record_id IS NOT NULL
)
DELETE FROM funding_programs
WHERE id IN (SELECT id FROM ranked WHERE duplicate_rank > 1);

UPDATE funding_programs
SET workspace_id = NULL
WHERE workspace_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS funding_programs_shared_source_record_unique_idx
  ON funding_programs (source_id, source_record_id)
  WHERE source_id IS NOT NULL AND source_record_id IS NOT NULL;
