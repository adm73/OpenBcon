-- A company creator is immutable and must always reference a real user.

UPDATE companies
SET created_by = owner_user_id
WHERE created_by IS NULL;

ALTER TABLE companies ALTER COLUMN created_by SET NOT NULL;
