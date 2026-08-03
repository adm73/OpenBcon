-- A required immutable creator cannot be nulled when its user is deleted.

ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_created_by_fkey,
  ADD CONSTRAINT companies_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT;
