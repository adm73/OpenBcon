-- Use the public strategic reports name for persisted LangGraph runs.

DO $$
BEGIN
  IF to_regclass('public.strategic_review') IS NOT NULL
     AND to_regclass('public.strategic_reports') IS NULL THEN
    ALTER TABLE strategic_review RENAME TO strategic_reports;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.strategic_review_application_idx') IS NOT NULL
     AND to_regclass('public.strategic_reports_application_idx') IS NULL THEN
    ALTER INDEX strategic_review_application_idx
      RENAME TO strategic_reports_application_idx;
  END IF;

  IF to_regclass('public.strategic_review_workspace_idx') IS NOT NULL
     AND to_regclass('public.strategic_reports_workspace_idx') IS NULL THEN
    ALTER INDEX strategic_review_workspace_idx
      RENAME TO strategic_reports_workspace_idx;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.strategic_reports') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'strategic_review_set_updated_at'
        AND tgrelid = 'public.strategic_reports'::regclass
    ) THEN
      ALTER TRIGGER strategic_review_set_updated_at
        ON strategic_reports RENAME TO strategic_reports_set_updated_at;
    END IF;
  END IF;
END
$$;
