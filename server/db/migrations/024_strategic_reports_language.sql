ALTER TABLE strategic_reports
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en-CA';

ALTER TABLE strategic_reports
  DROP CONSTRAINT IF EXISTS strategic_reports_language_check;

ALTER TABLE strategic_reports
  ADD CONSTRAINT strategic_reports_language_check
  CHECK (language IN ('en-CA', 'fr-CA', 'zh-CN'));
