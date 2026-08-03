-- Each application owns exactly one Strategic Report.

CREATE UNIQUE INDEX IF NOT EXISTS strategic_reports_application_unique_idx
  ON strategic_reports (application_id);
