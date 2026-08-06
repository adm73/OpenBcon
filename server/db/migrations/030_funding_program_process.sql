-- Describe how an applicant starts, submits, and follows up on a funding program.

ALTER TABLE funding_programs
  ADD COLUMN IF NOT EXISTS process text NOT NULL DEFAULT '';

UPDATE funding_programs
SET process = CASE
  WHEN btrim(process) <> '' THEN process
  WHEN category = 'Loan' THEN
    'Start with an eligibility and borrowing conversation with the funding provider. Prepare financial statements, a cash flow forecast, ownership details, and a use-of-funds plan. Contact the provider to confirm the application route, submit the package, and respond to underwriting questions.'
  ELSE
    'Review the eligibility requirements, confirm the program contact and intake route, and prepare the required evidence. Contact the program administrator before submitting the application, then follow the published review process and respond to any requests for clarification.'
END
WHERE process IS NULL OR btrim(process) = '';
