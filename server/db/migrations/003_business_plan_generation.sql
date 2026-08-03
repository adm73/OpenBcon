CREATE TABLE IF NOT EXISTS companies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  legal_name text,
  founder_name text NOT NULL,
  business_summary text NOT NULL,
  industry text,
  location text,
  stage text,
  revenue_model text,
  team_background text,
  traction text,
  use_of_funds text,
  annual_revenue numeric(14, 2),
  monthly_revenue numeric(14, 2),
  employee_count integer,
  website text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by bigint REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by bigint REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE companies
  ADD CONSTRAINT companies_workspace_name_key UNIQUE (workspace_id, name);

CREATE INDEX IF NOT EXISTS companies_workspace_idx
  ON companies (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS funding_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text,
  category text,
  program_url text,
  funding_amount numeric(14, 2),
  currency text NOT NULL DEFAULT 'CAD',
  location text,
  raw_guidelines_text text,
  target_outcome text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by bigint REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by bigint REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funding_programs_workspace_idx
  ON funding_programs (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS funding_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  funding_program_id uuid NOT NULL REFERENCES funding_programs(id) ON DELETE CASCADE,
  created_by bigint REFERENCES app_users(id) ON DELETE SET NULL,
  package_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_document jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('draft', 'generating', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS funding_packages_workspace_idx
  ON funding_packages (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS funding_package_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES funding_packages(id) ON DELETE CASCADE,
  requested_by_user_id bigint REFERENCES app_users(id) ON DELETE SET NULL,
  model_name text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  token_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  graph_trace jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('queued', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS funding_package_runs_package_idx
  ON funding_package_runs (package_id, created_at DESC);

CREATE TABLE IF NOT EXISTS funding_package_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_run_id uuid NOT NULL REFERENCES funding_package_runs(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funding_package_sections_run_idx
  ON funding_package_sections (package_run_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS funding_package_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_run_id uuid NOT NULL REFERENCES funding_package_runs(id) ON DELETE CASCADE,
  artifact_type text NOT NULL,
  storage_path text,
  mime_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funding_package_artifacts_run_idx
  ON funding_package_artifacts (package_run_id, created_at DESC);

DROP TRIGGER IF EXISTS companies_set_updated_at ON companies;
CREATE TRIGGER companies_set_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS funding_programs_set_updated_at ON funding_programs;
CREATE TRIGGER funding_programs_set_updated_at
BEFORE UPDATE ON funding_programs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS funding_packages_set_updated_at ON funding_packages;
CREATE TRIGGER funding_packages_set_updated_at
BEFORE UPDATE ON funding_packages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
