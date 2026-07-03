-- 0025: RELOCATION — unread tracking.
--
-- The house messages you unprompted (follow-ups, buzzes, drop-ins, bulletins) and
-- those land in the persona's OWN thread. For that to feel like WhatsApp — a badge,
-- the thread jumping to the top — we need to know what you've already read.
--
-- z.thread_reads: one row per (user, thread), stamped with the last time that user
-- opened/read the thread. unread = messages in the thread newer than last_read_at.
-- This is the accurate model (a timestamp, not a drifting counter): read on one
-- device, and the badge clears correctly on another, because it's derived, not stored.
--
-- Works for BOTH 1:1 persona threads and shared threads (DMs, rooms) — the key is
-- (user_id, thread_id), so each member tracks their own read position.
--
-- Types follow the uuid core (users.id, threads.id are uuid). RLS casts
-- auth.uid()::text per the 0002 lesson (auth_user_id is text).

create table if not exists z.thread_reads (
  user_id       uuid not null references z.users(id) on delete cascade,
  thread_id     uuid not null references z.threads(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (user_id, thread_id)
);
create index if not exists thread_reads_user on z.thread_reads (user_id);

alter table z.thread_reads enable row level security;

-- a user may see / manage only their own read rows
drop policy if exists thread_reads_own on z.thread_reads;
create policy thread_reads_own on z.thread_reads for all
  using (user_id in (select id from z.users where auth_user_id = auth.uid()::text));

-- the engine (service role) also writes these on delivery/read; service role bypasses RLS.
