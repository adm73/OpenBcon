-- Associate every company with the user who owns it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN owner_user_id bigint;
  END IF;
END $$;

UPDATE companies AS companies
SET owner_user_id = COALESCE(
  companies.created_by,
  (
    SELECT members.user_id
    FROM workspace_members AS members
    WHERE members.workspace_id = companies.workspace_id
    ORDER BY CASE members.role WHEN 'owner' THEN 0 ELSE 1 END, members.created_at ASC
    LIMIT 1
  )
)
WHERE companies.owner_user_id IS NULL;

ALTER TABLE companies ALTER COLUMN owner_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_owner_user_id_fkey'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT companies_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE RESTRICT;
  END IF;
END $$;
