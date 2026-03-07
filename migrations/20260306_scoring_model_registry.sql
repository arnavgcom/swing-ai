create table if not exists app_settings (
  key varchar primary key,
  value jsonb not null,
  updated_at timestamp not null default now()
);

alter table metrics add column if not exists model_version varchar not null default '0.1';
alter table analysis_shot_discrepancies add column if not exists model_version varchar not null default '0.1';

create table if not exists scoring_model_registry_entries (
  id varchar primary key default gen_random_uuid(),
  model_version varchar not null,
  model_version_description text not null,
  movement_type text not null,
  movement_detection_accuracy_pct real not null,
  scoring_accuracy_pct real not null,
  datasets_used jsonb not null default '[]'::jsonb,
  created_by_user_id varchar references users(id),
  created_at timestamp not null default now()
);

create table if not exists scoring_model_registry_dataset_metrics (
  id varchar primary key default gen_random_uuid(),
  registry_entry_id varchar not null references scoring_model_registry_entries(id),
  dataset_name text not null,
  movement_type text not null,
  movement_detection_accuracy_pct real not null,
  scoring_accuracy_pct real not null
);
