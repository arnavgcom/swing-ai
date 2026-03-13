ALTER TABLE metrics
ADD COLUMN IF NOT EXISTS ai_diagnostics jsonb;

ALTER TABLE metrics
DROP COLUMN IF EXISTS tactical_scores;

ALTER TABLE metrics
DROP COLUMN IF EXISTS sub_scores;
