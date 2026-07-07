-- ════════════════════════════════════════════════════════════════════════
--  0049_mm_brief — THE CLIENT BRIEF: the Media Manager's own working notes
--  on the one client he manages (the user). Single row per user; the advisor
--  reads it on every turn and never asks for what is already written here.
--  Written from the room's structured form; the engine upserts whole.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.mm_brief (
  user_id      uuid primary key,
  display_name text,
  handle       text,
  platforms    text,
  niche        text,
  pillars      text,
  audience     text,
  stage        text,
  goal         text,
  deals        text,
  cadence      text,
  notes        text,
  updated_at   timestamptz not null default now()
);
alter table z.mm_brief enable row level security;
