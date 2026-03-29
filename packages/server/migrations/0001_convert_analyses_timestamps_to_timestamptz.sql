DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'analyses'
      AND column_name = 'captured_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE 'ALTER TABLE analyses ALTER COLUMN captured_at TYPE timestamptz USING captured_at AT TIME ZONE ''UTC''';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'analyses'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE format(
      'ALTER TABLE analyses ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE %L',
      current_setting('TIMEZONE')
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'analyses'
      AND column_name = 'updated_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    EXECUTE format(
      'ALTER TABLE analyses ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE %L',
      current_setting('TIMEZONE')
    );
  END IF;
END $$;
