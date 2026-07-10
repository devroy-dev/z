-- 0059 — RUNNING THREADS: what a persona and this person have going between
-- them. Their diary simulates THEIR life; this accrues the SHARED one. Max 3
-- open per persona enforced in code (oldest open auto-closes on the 4th).
create table if not exists z.running_threads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  persona_key  text not null,
  title        text not null,
  detail       text,
  status       text not null default 'open',   -- open | closed
  last_touched timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create unique index if not exists running_threads_uniq
  on z.running_threads (user_id, persona_key, lower(title));
create index if not exists running_threads_user_idx
  on z.running_threads (user_id, persona_key, status, last_touched desc);
alter table z.running_threads enable row level security;
