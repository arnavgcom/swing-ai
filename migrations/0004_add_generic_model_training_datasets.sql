create table if not exists model_training_datasets (
  id varchar primary key default gen_random_uuid(),
  model_family text not null,
  sport_name text not null default 'tennis',
  dataset_name text not null,
  source text not null default 'manual-annotation',
  analysis_count integer not null default 0,
  row_count integer not null default 0,
  notes text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  created_by_user_id varchar references users(id),
  updated_by_user_id varchar references users(id)
);

create table if not exists model_training_dataset_rows (
  id varchar primary key default gen_random_uuid(),
  dataset_id varchar not null references model_training_datasets(id),
  analysis_id varchar not null references analyses(id),
  user_id varchar references users(id),
  video_filename text not null,
  shot_index integer not null,
  group_key text not null,
  label text not null,
  heuristic_label text,
  heuristic_confidence real,
  heuristic_reasons jsonb not null default '[]'::jsonb,
  feature_values jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  created_by_user_id varchar references users(id),
  updated_by_user_id varchar references users(id)
);

create index if not exists model_training_dataset_rows_dataset_idx
on model_training_dataset_rows (dataset_id, shot_index);

do $$
begin
  if to_regclass('public.tennis_training_datasets') is not null then
    insert into model_training_datasets (
      id,
      model_family,
      sport_name,
      dataset_name,
      source,
      analysis_count,
      row_count,
      notes,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
    )
    select
      legacy.id,
      'movement-classifier',
      legacy.sport_name,
      legacy.dataset_name,
      legacy.source,
      legacy.analysis_count,
      legacy.row_count,
      legacy.notes,
      legacy.created_at,
      legacy.updated_at,
      legacy.created_by_user_id,
      legacy.updated_by_user_id
    from tennis_training_datasets legacy
    where not exists (
      select 1
      from model_training_datasets datasets
      where datasets.id = legacy.id
    );
  end if;
end $$;

do $$
begin
  if to_regclass('public.tennis_training_dataset_rows') is not null then
    insert into model_training_dataset_rows (
      id,
      dataset_id,
      analysis_id,
      user_id,
      video_filename,
      shot_index,
      group_key,
      label,
      heuristic_label,
      heuristic_confidence,
      heuristic_reasons,
      feature_values,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
    )
    select
      legacy.id,
      legacy.dataset_id,
      legacy.analysis_id,
      legacy.user_id,
      legacy.video_filename,
      legacy.shot_index,
      legacy.group_key,
      legacy.label,
      legacy.heuristic_label,
      legacy.heuristic_confidence,
      legacy.heuristic_reasons,
      legacy.feature_values,
      legacy.created_at,
      legacy.updated_at,
      legacy.created_by_user_id,
      legacy.updated_by_user_id
    from tennis_training_dataset_rows legacy
    where not exists (
      select 1
      from model_training_dataset_rows rows
      where rows.id = legacy.id
    );
  end if;
end $$;
