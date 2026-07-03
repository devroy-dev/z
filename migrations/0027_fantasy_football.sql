-- 0027: FANTASY FOOTBALL — the house league on real EPL data. Player pool,
-- gameweeks, and per-player points come from the FPL public API (synced by
-- the engine; nothing invented). Users pick 5 + a captain under a 40.0
-- budget; scores are real gameweek points, captain doubled. Phantom stakes
-- only — no entry, no prizes, no real value (the economy layer is gated).
--
-- Squad rollover doctrine: a squad row is written per (user, gw). Scoring
-- resolves the EFFECTIVE squad for a gameweek as the most recent squad row
-- with gw' <= gw — so a user who sets a squad once stays in the league
-- without touching it again.

create table if not exists z.ff_players (
  id            int primary key,          -- FPL element id
  name          text not null,            -- web_name
  full_name     text,
  team          text not null,            -- club short name, e.g. 'ARS'
  pos           text not null check (pos in ('GK','DEF','MID','FWD')),
  cost          numeric not null,         -- FPL now_cost / 10
  total_points  int not null default 0,
  status        text,                     -- 'a' available, 'i' injured, ...
  news          text,
  updated_at    timestamptz not null default now()
);
create index if not exists ff_players_pts_idx on z.ff_players (total_points desc);

create table if not exists z.ff_gameweeks (
  gw          int primary key,
  deadline    timestamptz not null,
  finished    boolean not null default false,
  is_current  boolean not null default false,
  scored      boolean not null default false,   -- our finalize marker
  updated_at  timestamptz not null default now()
);

create table if not exists z.ff_squads (
  user_id     uuid not null references z.users(id) on delete cascade,
  gw          int not null,
  player_ids  int[] not null,
  captain     int not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, gw)
);

create table if not exists z.ff_scores (
  user_id    uuid not null references z.users(id) on delete cascade,
  gw         int not null,
  points     int not null,
  breakdown  jsonb,                        -- [{id, name, points, captain}]
  primary key (user_id, gw)
);
create index if not exists ff_scores_user_idx on z.ff_scores (user_id);

alter table z.ff_players   enable row level security;
alter table z.ff_gameweeks enable row level security;
alter table z.ff_squads    enable row level security;
alter table z.ff_scores    enable row level security;

do $$ begin
  create policy ff_players_read on z.ff_players for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy ff_gameweeks_read on z.ff_gameweeks for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy ff_squads_owner on z.ff_squads for select
    using (user_id = (select id from z.users where auth_user_id = auth.uid()::text));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy ff_scores_owner on z.ff_scores for select
    using (user_id = (select id from z.users where auth_user_id = auth.uid()::text));
exception when duplicate_object then null; end $$;
