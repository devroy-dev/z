-- 0061 — THE GATE BECOMES REAL: consent recorded server-side, age checked from
-- dob. The client flag becomes a cache, never the authority. (ROOMS_SPEC v1 §3,
-- amended per ROOMS_STATUS audit: the missing member-count RPC pair rides here,
-- plus the thread_id index every public-identity lookup needs.)
alter table z.users add column if not exists public_consent_at timestamptz;

-- the per-message "is this thread a public room?" lookup — without this index
-- every public-identity check is a table scan.
create index if not exists public_rooms_thread on z.public_rooms (thread_id);

-- member_count, atomically. The join route's read-modify-write fallback was
-- racy; the leave route never decremented at all (counts ratcheted — audit).
create or replace function z.increment_public_room_count(rid uuid)
returns void language sql security definer set search_path = z as $$
  update z.public_rooms set member_count = member_count + 1 where id = rid;
$$;

create or replace function z.decrement_public_room_count(rid uuid)
returns void language sql security definer set search_path = z as $$
  update z.public_rooms set member_count = greatest(member_count - 1, 0) where id = rid;
$$;
