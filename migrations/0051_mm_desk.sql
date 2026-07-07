-- ════════════════════════════════════════════════════════════════════════
--  0051_mm_desk — THE DESK THAT WATCHES: the Media Manager's analytics ledger
--  and his weekly desk notes. Analytics rows come from screenshot uploads read
--  by his eye (vision route); two rows make a direction, five make a curve.
--  Desk notes are his weekly written memo on the client vs the brief — work
--  product that accrues in the room, written by the house's scheduler.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.mm_analytics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  platform    text,
  followers   text,
  reach       text,
  growth      text,
  top_content text,
  period      text,
  created_at  timestamptz not null default now()
);
create index if not exists mm_analytics_user_idx on z.mm_analytics (user_id, created_at desc);
alter table z.mm_analytics enable row level security;

create table if not exists z.mm_desk_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  note       text not null,
  created_at timestamptz not null default now()
);
create index if not exists mm_desk_notes_user_idx on z.mm_desk_notes (user_id, created_at desc);
alter table z.mm_desk_notes enable row level security;
