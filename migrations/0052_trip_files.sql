-- [zip71] THE TRIP FILE — the Wanderer's record, one row per destination per user.
-- Fills from conversation (she emits [[TRIP: ...]]); rides every turn like the wardrobe.
create table if not exists z.trip_files (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  destination  text not null,
  dates        text,
  travelers    text,
  notes        text,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create unique index if not exists trip_files_user_dest_idx on z.trip_files (user_id, lower(destination));
create index if not exists trip_files_user_idx on z.trip_files (user_id, updated_at desc);
alter table z.trip_files enable row level security;
