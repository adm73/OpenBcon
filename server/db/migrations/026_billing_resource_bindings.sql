-- Bind externally visible Stripe resources to their authenticated owner.

CREATE TABLE IF NOT EXISTS billing_resource_bindings (
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_type, resource_id),
  CHECK (resource_type IN ('checkout_session', 'customer'))
);

CREATE INDEX IF NOT EXISTS billing_resource_bindings_owner_idx
  ON billing_resource_bindings (workspace_id, user_id, resource_type);
