-- Keep workspace membership roles aligned with the platform user roles.
-- Existing owner/member/viewer memberships are normalized before the stricter
-- constraint is applied so upgrades do not fail on legacy rows.
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;

UPDATE workspace_members
SET role = CASE role
  WHEN 'owner' THEN 'admin'
  WHEN 'member' THEN 'default'
  WHEN 'viewer' THEN 'default'
  ELSE role
END
WHERE role IN ('owner', 'member', 'viewer');

ALTER TABLE workspace_members
  ALTER COLUMN role SET DEFAULT 'default';

ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('admin', 'default'));
