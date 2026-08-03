-- Strategic review reports are the single persisted output for an application.

DO $$
DECLARE
  has_legacy_column boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'applications'
      AND column_name = 'generated_package'
  ) INTO has_legacy_column;

  IF has_legacy_column THEN
    UPDATE applications
    SET strategic_review_reports = strategic_review_reports || jsonb_build_array(
      jsonb_build_object(
        'id', 'strategic-review-' || id::text,
        'applicationId', id::text,
        'generatedPackage', generated_package
      )
    )
    WHERE generated_package IS NOT NULL
      AND jsonb_typeof(strategic_review_reports) = 'array';

    ALTER TABLE applications DROP COLUMN generated_package;
  END IF;
END $$;
