ALTER TABLE metrics
ADD COLUMN IF NOT EXISTS score_outputs jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'metrics' AND column_name = 'tactical_scores'
  ) THEN
    UPDATE metrics
    SET score_outputs =
      jsonb_set(
        COALESCE(score_outputs, '{}'::jsonb),
        '{tactical}',
        COALESCE(score_outputs -> 'tactical', '{}'::jsonb)
          || jsonb_build_object(
            'overall', COALESCE(
              (score_outputs -> 'tactical' ->> 'overall')::numeric,
              (score_outputs ->> 'tactical')::numeric,
              ROUND((
                COALESCE((tactical_scores ->> 'power')::numeric, 0) * 0.30
                + COALESCE((tactical_scores ->> 'control')::numeric, 0) * 0.25
                + COALESCE((tactical_scores ->> 'timing')::numeric, 0) * 0.25
                + COALESCE((tactical_scores ->> 'technique')::numeric, 0) * 0.20
              )::numeric, 1)
            ),
            'components', jsonb_build_object(
              'power', COALESCE((tactical_scores ->> 'power')::numeric, 0),
              'control', COALESCE((tactical_scores ->> 'control')::numeric, 0),
              'timing', COALESCE((tactical_scores ->> 'timing')::numeric, 0),
              'technique', COALESCE((tactical_scores ->> 'technique')::numeric, 0)
            )
          ),
        true
      )
    WHERE tactical_scores IS NOT NULL;

    ALTER TABLE metrics
    DROP COLUMN IF EXISTS tactical_scores;
  END IF;
END $$;

ALTER TABLE metrics
DROP COLUMN IF EXISTS sub_scores;
