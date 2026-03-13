CREATE TABLE IF NOT EXISTS sport_category_metric_ranges (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_name text NOT NULL,
  movement_name text NOT NULL,
  config_key varchar NOT NULL,
  metric_key text NOT NULL,
  metric_label text NOT NULL,
  unit text NOT NULL,
  optimal_min real NOT NULL,
  optimal_max real NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'config',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sport_category_metric_ranges_config_metric_uq
  ON sport_category_metric_ranges (config_key, metric_key);

CREATE INDEX IF NOT EXISTS sport_category_metric_ranges_sport_movement_idx
  ON sport_category_metric_ranges (sport_name, movement_name, is_active);
