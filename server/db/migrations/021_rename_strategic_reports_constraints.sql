-- Remove the final legacy constraint names left by the table rename.

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOREACH constraint_name IN ARRAY ARRAY[
    'strategic_review_application_id_fkey',
    'strategic_review_owner_user_id_fkey',
    'strategic_review_workspace_id_fkey',
    'strategic_review_status_check'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.strategic_reports'::regclass
        AND conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE strategic_reports RENAME CONSTRAINT %I TO %I',
        constraint_name,
        replace(constraint_name, 'strategic_review', 'strategic_reports')
      );
    END IF;
  END LOOP;
END
$$;
