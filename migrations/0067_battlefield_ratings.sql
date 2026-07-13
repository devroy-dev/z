-- 0067 — THE LADDER: Elo per format. Ranked = public + timed + commentary-on.
-- The spec-authored block (§9), verbatim:
create table if not exists z.battlefield_ratings (
  user_id     uuid not null,
  format_key  text not null,
  elo         int not null default 1200,
  wins        int not null default 0,
  losses      int not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, format_key)
);
alter table z.battlefield_ratings enable row level security;

-- Declared additions beyond the spec block (both are the ladder's own plumbing):
-- 1) the leaderboard's read path — top-N by elo per format
create index if not exists bf_ratings_ladder_idx on z.battlefield_ratings (format_key, elo desc);
-- 2) ranked is OPT-IN AT CREATE (spec §9) — the challenge row must carry the choice
--    so the claim builds a ranked floor (0064 predates the ladder).
alter table z.battlefield_challenges add column if not exists ranked boolean not null default false;
