-- Store the country separately from the program's province, region, or coverage.

ALTER TABLE funding_programs
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Canada';

UPDATE funding_programs
SET country = 'Canada'
WHERE country IS NULL OR btrim(country) = '';
