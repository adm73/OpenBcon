-- Store the currency used by each funding program amount.

ALTER TABLE funding_programs
  ADD COLUMN IF NOT EXISTS currency text;

UPDATE funding_programs
SET currency = 'CAD'
WHERE currency IS NULL OR btrim(currency) = '';

ALTER TABLE funding_programs
  ALTER COLUMN currency SET DEFAULT 'CAD',
  ALTER COLUMN currency SET NOT NULL;
