-- 0028: FANTASY FOOTBALL goes MULTI-LEAGUE (EPL + UCL) with FULL XI +
-- FORMATIONS. Squads are now 11 players under football-legal formations
-- (1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD), max 3 per club, per-league budget.
--
-- League data contracts (both verified with real responses on prod curls):
--   • EPL: FPL public API — players, deadlines, per-player gameweek points.
--   • UCL: UEFA fantasy feeds — players (players_70_en_1.json) and fixtures
--     (fixtures_70_en.json: mdId, deadline, matches). UEFA has NO verified
--     per-matchday points feed, so UCL is scored by SNAPSHOT DELTAS: we
--     snapshot every player's season totPts at the matchday lock, and the
--     matchday score is totPts_after − totPts_at_lock. Deterministic, uses
--     only verified feeds, never invents a number. ff_md_snapshots holds it.
--
-- Timezone law for UEFA timestamps (no tz in feed): parsed as UTC+2 with a
-- further 60-minute safety buffer on deadlines — we may lock early, never late.
--
-- No data-loss risk: no squads or scores can exist yet (no gameweek has had
-- an open deadline since launch), so the PK rework is clean.

-- ── league column everywhere, composite keys ──────────────────────────────
alter table z.ff_players add column if not exists league text not null default 'epl';
alter table z.ff_players drop constraint if exists ff_players_pkey;
alter table z.ff_players add primary key (league, id);

alter table z.ff_gameweeks add column if not exists league text not null default 'epl';
alter table z.ff_gameweeks add column if not exists kickoff_first timestamptz;
alter table z.ff_gameweeks add column if not exists kickoff_last timestamptz;
alter table z.ff_gameweeks drop constraint if exists ff_gameweeks_pkey;
alter table z.ff_gameweeks add primary key (league, gw);

alter table z.ff_squads add column if not exists league text not null default 'epl';
alter table z.ff_squads drop constraint if exists ff_squads_pkey;
alter table z.ff_squads add primary key (user_id, league, gw);

alter table z.ff_scores add column if not exists league text not null default 'epl';
alter table z.ff_scores drop constraint if exists ff_scores_pkey;
alter table z.ff_scores add primary key (user_id, league, gw);

-- ── UCL matchday snapshots: player totPts at the lock ─────────────────────
create table if not exists z.ff_md_snapshots (
  league     text not null,
  gw         int not null,
  player_id  int not null,
  points_at  int not null,               -- season totPts at lock
  taken_at   timestamptz not null default now(),
  primary key (league, gw, player_id)
);

alter table z.ff_md_snapshots enable row level security;
do $$ begin
  create policy ff_md_snapshots_read on z.ff_md_snapshots for select using (true);
exception when duplicate_object then null; end $$;
