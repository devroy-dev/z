-- 0024: FRIENDS v1 + durable photos.
--
-- FRIENDS SPINE (roadmap "the friends spine"):
--   • z.users.handle — a unique @name, set once in the You tab. The lawyer-clean
--     identity: no phone numbers stored raw; matching is by handle now, phone-hash later.
--   • z.friendships — a request/accept edge between two users. One row per pair,
--     canonicalised (lo < hi) so (A,B) and (B,A) can't both exist. status walks
--     pending → accepted (or blocked). requested_by records who sent it, so the
--     other side is the one who may accept.
--
-- DURABLE PHOTOS (folded in per Dev's ruling — was parked from the image-share sitting):
--   • z.messages.image_url — where a shared photo lives once uploaded to the
--     z-photos bucket, so a room thumbnail survives a reload instead of collapsing
--     to the "[shared a photo]" text marker. The vision turn is unchanged; this is
--     display persistence only.
--
-- TYPE NOTE (settling part of the 0023 debt): the core (users, threads, messages)
-- keys on uuid; 0023's scheduled_pings/feedback used text user_id, which was
-- inconsistent. New tables here follow the uuid core (user_id uuid references
-- z.users(id)). 0023's existing text columns are NOT converted in-place — that is a
-- separate, data-bearing migration and is flagged here so it isn't forgotten. The
-- RLS lesson from 0002 still applies: auth_user_id is TEXT, so every policy casts
-- auth.uid()::text (never bare auth.uid(), which is uuid → "operator does not exist:
-- text = uuid").

-- ── handles ──────────────────────────────────────────────────────────────
alter table z.users add column if not exists handle text;
-- unique, case-insensitive, only when set (nulls allowed until the user picks one)
create unique index if not exists users_handle_unique
  on z.users (lower(handle)) where handle is not null;

-- ── friendships ──────────────────────────────────────────────────────────
create table if not exists z.friendships (
  id            uuid primary key default gen_random_uuid(),
  user_lo       uuid not null references z.users(id) on delete cascade,  -- canonical: the smaller uuid
  user_hi       uuid not null references z.users(id) on delete cascade,  -- the larger uuid
  requested_by  uuid not null references z.users(id) on delete cascade,  -- who sent the request
  status        text not null default 'pending'
                  check (status in ('pending','accepted','blocked')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friendships_distinct check (user_lo <> user_hi),
  constraint friendships_ordered  check (user_lo < user_hi),
  unique (user_lo, user_hi)
);
create index if not exists friendships_lo on z.friendships (user_lo) where status = 'accepted';
create index if not exists friendships_hi on z.friendships (user_hi) where status = 'accepted';
-- pending requests awaiting the OTHER person: cheap lookup by who must respond
create index if not exists friendships_pending on z.friendships (user_lo, user_hi) where status = 'pending';

-- ── durable photo url on messages ────────────────────────────────────────
alter table z.messages add column if not exists image_url text;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table z.friendships enable row level security;

-- a user may SEE a friendship row if they are either side of it
drop policy if exists friendships_self_select on z.friendships;
create policy friendships_self_select on z.friendships for select
  using (
    user_lo in (select id from z.users where auth_user_id = auth.uid()::text)
    or
    user_hi in (select id from z.users where auth_user_id = auth.uid()::text)
  );

-- writes (request, accept, block) go through the engine on the service role,
-- which bypasses RLS — no public insert/update/delete policies, same pattern as
-- z.scheduled_pings / z.feedback in 0023. The engine validates the edge (e.g. only
-- the non-requester may accept) in application code.
