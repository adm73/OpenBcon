-- Store only one-way password hashes for database-backed user authentication.

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS password_hash text;
