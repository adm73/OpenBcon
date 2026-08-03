-- Null report placeholders cannot be opened and should not reach the client.
UPDATE applications
SET strategic_review_reports = COALESCE(
  (
    SELECT jsonb_agg(report)
    FROM jsonb_array_elements(strategic_review_reports) AS report
    WHERE jsonb_typeof(report) = 'object'
      AND report->'generatedPackage' IS NOT NULL
      AND jsonb_typeof(report->'generatedPackage') = 'object'
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof(strategic_review_reports) = 'array';
