-- 0015: the usage meter — every model call logs its cost (per user, per surface).
-- Foundation of unit economics + tier caps (#51). Service-role writes only.
create table if not exists z.usage_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references z.users(id) on delete cascade,
  thread_id uuid,
  persona_key text,
  surface text not null default 'other',
  model text not null,
  tok_in integer not null default 0,
  tok_out integer not null default 0,
  tok_cache_read integer not null default 0,
  tok_cache_write integer not null default 0,
  cost_inr numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists usage_log_user_day on z.usage_log (user_id, created_at desc);
alter table z.usage_log enable row level security;
-- no user policies: the engine (service role) reads/writes; users never touch it directly.
