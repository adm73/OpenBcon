-- Persist the complete LangGraph strategic review run and its final result.

CREATE TABLE IF NOT EXISTS strategic_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id bigint NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  model_name text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  graph_trace jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS strategic_review_application_idx
  ON strategic_review (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS strategic_review_workspace_idx
  ON strategic_review (workspace_id, created_at DESC);

DROP TRIGGER IF EXISTS strategic_review_set_updated_at ON strategic_review;
CREATE TRIGGER strategic_review_set_updated_at
BEFORE UPDATE ON strategic_review
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
