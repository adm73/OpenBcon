-- Keep the primary-key constraint and index aligned with the table name.

DO $$
BEGIN
  IF to_regclass('public.strategic_reports') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.strategic_reports'::regclass
         AND conname = 'strategic_review_pkey'
     ) THEN
    ALTER TABLE strategic_reports
      RENAME CONSTRAINT strategic_review_pkey TO strategic_reports_pkey;
  END IF;

  IF to_regclass('public.strategic_review_pkey') IS NOT NULL
     AND to_regclass('public.strategic_reports_pkey') IS NULL THEN
    ALTER INDEX strategic_review_pkey RENAME TO strategic_reports_pkey;
  END IF;
END
$$;
