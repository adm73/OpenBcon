ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;

UPDATE app_users
SET role = CASE role
  WHEN 'owner' THEN 'admin'
  WHEN 'member' THEN 'default'
  ELSE role
END
WHERE role IN ('owner', 'member');

ALTER TABLE app_users
  ALTER COLUMN role SET DEFAULT 'default';

ALTER TABLE app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('admin', 'default'));
