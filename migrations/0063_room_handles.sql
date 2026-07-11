-- 0063 — HANDLES: strangers meet handles, never profiles. One alias per
-- member per public room, chosen at the doorway, doorman-checked.
-- (ROOMS_SPEC v1 §7.1, as written. 0062 is RESERVED for the R2 safety set —
-- the hole is deliberate; never fill or renumber it. BUILD_PROTOCOL §2.4.)
create table if not exists z.room_handles (
  thread_id   uuid not null,
  user_id     uuid not null,
  handle      text not null,
  created_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create unique index if not exists room_handles_uniq on z.room_handles (thread_id, lower(handle));
alter table z.room_handles enable row level security;
