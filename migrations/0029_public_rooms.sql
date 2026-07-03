-- 0029: COMMUNITIES — public rooms with a built-in moderator (the doorman).
--
-- Public = strangers, so the doorman is not a feature — it is the license to exist.
-- These tables give us: a directory of curated house rooms (each bound to a shared
-- thread, reusing the whole room machinery), and a sanctions ledger the doorman
-- writes to (mute / kick / ban) and the send path reads before letting a message land.
--
-- A public room is a house-owned shared thread: is_shared=true, member_keys = the
-- resident personas (always including the_moderator as the doorman). Everyone joins
-- the SAME thread (via room_members), unlike private rooms which are user-owned.

create table if not exists z.public_rooms (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references z.threads(id) on delete cascade,
  slug          text not null unique,                 -- 'football-stands', 'trading-pit'
  name          text not null,                        -- 'the football stands'
  theme         text not null,                        -- one-line description for the card
  persona_keys  text[] not null default '{}',         -- residents (incl. the_moderator)
  member_count  int not null default 0,
  sort_order    int not null default 0,               -- directory ordering
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists public_rooms_active on z.public_rooms (active, sort_order);

-- the doorman's ledger: every mute/kick/ban, with an expiry (null = permanent, i.e. ban).
create table if not exists z.room_sanctions (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references z.public_rooms(id) on delete cascade,
  user_id       uuid not null references z.users(id) on delete cascade,
  kind          text not null check (kind in ('mute','kick','ban')),
  until         timestamptz,                           -- when it lifts; null = permanent (ban)
  reason        text,                                  -- what tripped it (class/severity)
  created_at    timestamptz not null default now()
);
-- fast "is this user currently sanctioned in this room?" lookup
create index if not exists room_sanctions_active on z.room_sanctions (room_id, user_id, created_at desc);

-- strikes: the escalation counter. one row per infraction; the ladder reads the
-- count in a rolling window to decide warn(1) -> mute(2) -> kick(3).
create table if not exists z.room_strikes (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references z.public_rooms(id) on delete cascade,
  user_id       uuid not null references z.users(id) on delete cascade,
  severity      text not null default 'low',           -- 'low' | 'severe'
  reason        text,
  created_at    timestamptz not null default now()
);
create index if not exists room_strikes_user on z.room_strikes (room_id, user_id, created_at desc);

-- RLS: directory + membership reads are public to authed users; sanctions/strikes are
-- engine-only (service role) — the doorman writes them, the send path reads them, the
-- user never queries them directly.
alter table z.public_rooms   enable row level security;
alter table z.room_sanctions enable row level security;
alter table z.room_strikes   enable row level security;

-- anyone authed may SEE the room directory
drop policy if exists public_rooms_read on z.public_rooms;
create policy public_rooms_read on z.public_rooms for select using (true);

-- sanctions/strikes: no public policies. engine (service role) bypasses RLS.
