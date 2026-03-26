create table if not exists model_training_jobs (
  id varchar primary key default gen_random_uuid(),
  job_id varchar not null unique,
  model_family text not null,
  sport_name text not null default 'tennis',
  status varchar not null,
  dataset_id text,
  eligible_analysis_count integer not null default 0,
  eligible_shot_count integer not null default 0,
  export_rows integer,
  train_rows integer,
  test_rows integer,
  macro_f1 real,
  model_output_path text,
  metadata jsonb,
  report jsonb,
  requested_at timestamp not null default now(),
  started_at timestamp,
  completed_at timestamp,
  requested_by_user_id varchar references users(id),
  saved_model_version varchar,
  saved_model_artifact_path text,
  saved_at timestamp,
  version_description text,
  error text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  created_by_user_id varchar references users(id),
  updated_by_user_id varchar references users(id)
);

create index if not exists model_training_jobs_family_sport_status_idx
on model_training_jobs (model_family, sport_name, status, completed_at);

create table if not exists model_training_state (
  id varchar primary key default gen_random_uuid(),
  model_family text not null,
  sport_name text not null default 'tennis',
  current_job_id varchar,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  created_by_user_id varchar references users(id),
  updated_by_user_id varchar references users(id)
);

create unique index if not exists model_training_state_scope_idx
on model_training_state (sport_name, model_family);

do $$
begin
  if to_regclass('public.tennis_model_training_runs') is not null then
    insert into model_training_jobs (
      id,
      job_id,
      model_family,
      sport_name,
      status,
      dataset_id,
      eligible_analysis_count,
      eligible_shot_count,
      export_rows,
      train_rows,
      test_rows,
      macro_f1,
      model_output_path,
      metadata,
      report,
      requested_at,
      started_at,
      completed_at,
      requested_by_user_id,
      saved_model_version,
      saved_model_artifact_path,
      saved_at,
      version_description,
      error,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
    )
    select
      legacy.id,
      legacy.job_id,
      'movement-classifier',
      legacy.sport_name,
      legacy.status,
      legacy.dataset_id::text,
      legacy.eligible_analysis_count,
      legacy.eligible_shot_count,
      legacy.export_rows,
      legacy.train_rows,
      legacy.test_rows,
      legacy.macro_f1,
      legacy.model_output_path,
      legacy.metadata,
      legacy.report,
      legacy.requested_at,
      legacy.started_at,
      legacy.completed_at,
      legacy.requested_by_user_id,
      legacy.saved_model_version,
      legacy.saved_model_artifact_path,
      legacy.saved_at,
      legacy.version_description,
      legacy.error,
      legacy.created_at,
      legacy.updated_at,
      legacy.created_by_user_id,
      legacy.updated_by_user_id
    from tennis_model_training_runs legacy
    where not exists (
      select 1
      from model_training_jobs jobs
      where jobs.job_id = legacy.job_id
    );
  end if;
end $$;

insert into model_training_state (
  model_family,
  sport_name,
  current_job_id,
  created_at,
  updated_at,
  created_by_user_id,
  updated_by_user_id
)
select
  'movement-classifier',
  'tennis',
  nullif(app_settings.value->>'currentJobId', ''),
  now(),
  now(),
  app_settings.created_by_user_id,
  app_settings.updated_by_user_id
from app_settings
where app_settings.key = 'tennisModelTrainingState'
  and not exists (
    select 1
    from model_training_state state
    where state.sport_name = 'tennis'
      and state.model_family = 'movement-classifier'
  );

delete from app_settings
where key = 'tennisModelTrainingState';
