-- Stable external identifier for application API calls.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS app_id text;

UPDATE applications
SET app_id = substring(
  encode(
    digest(id::text || ':' || created_at::text, 'sha256'),
    'hex'
  )
  FROM 1 FOR 16
)
WHERE app_id IS NULL;

ALTER TABLE applications
  ALTER COLUMN app_id SET NOT NULL;

ALTER TABLE applications
  ADD CONSTRAINT applications_app_id_format_check
  CHECK (app_id ~ '^[0-9a-f]{16}$');

CREATE UNIQUE INDEX IF NOT EXISTS applications_app_id_unique_idx
  ON applications (app_id);

CREATE OR REPLACE FUNCTION generate_application_app_id()
RETURNS trigger AS $$
DECLARE
  candidate text;
BEGIN
  IF NEW.app_id IS NULL OR btrim(NEW.app_id) = '' THEN
    candidate := substring(
      encode(
        digest(NEW.id::text || ':' || clock_timestamp()::text, 'sha256'),
        'hex'
      )
      FROM 1 FOR 16
    );

    WHILE EXISTS (SELECT 1 FROM applications WHERE app_id = candidate) LOOP
      candidate := substring(
        encode(
          digest(
            NEW.id::text || ':' || clock_timestamp()::text || ':' || gen_random_uuid()::text,
            'sha256'
          ),
          'hex'
        )
        FROM 1 FOR 16
      );
    END LOOP;

    NEW.app_id = candidate;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS applications_generate_app_id ON applications;
CREATE TRIGGER applications_generate_app_id
BEFORE INSERT ON applications
FOR EACH ROW EXECUTE FUNCTION generate_application_app_id();
