-- Email verification for password accounts and verified Google identities.

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_subject text;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_google_subject_idx
  ON app_users (google_subject)
  WHERE google_subject IS NOT NULL;

-- Accounts created before verification was introduced remain usable.
UPDATE app_users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx
  ON email_verification_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_verification_tokens_expiry_idx
  ON email_verification_tokens (expires_at)
  WHERE consumed_at IS NULL;
