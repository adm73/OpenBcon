-- Relational application records linked to companies, programs, and owners.

CREATE TABLE IF NOT EXISTS applications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  funding_program_id uuid NOT NULL REFERENCES funding_programs(id) ON DELETE RESTRICT,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  owner_user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  source_id text NOT NULL,
  title text NOT NULL,
  amount numeric(14, 2),
  currency text NOT NULL DEFAULT 'CAD',
  status text NOT NULL DEFAULT 'Draft',
  progress integer NOT NULL DEFAULT 0,
  deadline text NOT NULL DEFAULT 'Open',
  deadline_order integer NOT NULL DEFAULT 999,
  documents_complete integer NOT NULL DEFAULT 0,
  documents_total integer NOT NULL DEFAULT 0,
  next_action text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  strategic_review_reports jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (currency ~ '^[A-Z]{3}$'),
  CHECK (status IN ('Draft', 'In Review', 'Ready', 'Submitted', 'Awarded')),
  CHECK (progress >= 0 AND progress <= 100),
  CHECK (documents_complete >= 0),
  CHECK (documents_total >= 0),
  UNIQUE (workspace_id, source_id)
);

CREATE INDEX IF NOT EXISTS applications_workspace_idx
  ON applications (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS applications_company_idx
  ON applications (company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS applications_program_idx
  ON applications (funding_program_id, updated_at DESC);

DROP TRIGGER IF EXISTS applications_set_updated_at ON applications;
CREATE TRIGGER applications_set_updated_at
BEFORE UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
