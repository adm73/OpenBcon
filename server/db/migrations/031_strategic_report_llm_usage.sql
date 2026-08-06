-- Persist token usage for every LLM call made during a strategic report run.

CREATE TABLE IF NOT EXISTS strategic_report_llm_usage (
  id bigserial PRIMARY KEY,
  strategic_report_id uuid NOT NULL
    REFERENCES strategic_reports(id) ON DELETE CASCADE,
  node_name text NOT NULL,
  section_key text,
  model_name text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens integer NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strategic_report_llm_usage_report_idx
  ON strategic_report_llm_usage (strategic_report_id, created_at);
