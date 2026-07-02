-- 0016: proactive pings — the follow-up log + the seatbelt's shadow verdicts.
-- One row per ping sent; the seatbelt columns are the calibration corpus.
create table if not exists z.ping_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references z.users(id) on delete cascade,
  persona_key text not null,
  thread_id uuid,
  ping text not null,
  seatbelt_ok boolean,
  seatbelt_reason text,
  sent boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ping_log_user_day on z.ping_log (user_id, created_at desc);
alter table z.ping_log enable row level security;
