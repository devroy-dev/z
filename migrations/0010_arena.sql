-- 0010_arena.sql — Arena games: per-thread active game + score tracking + match history.
alter table z.threads add column if not exists game_mode text;   -- 'debate' | 'trivia' | 'dilemma' | null

-- match history (the player's track record per game)
create table if not exists z.arena_matches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references z.users(id) on delete cascade,
  game        text not null,
  persona_key text,
  you_score   int not null default 0,
  z_score     int not null default 0,
  winner      text,                       -- 'you' | 'z' | 'draw'
  created_at  timestamptz not null default now()
);
create index if not exists arena_matches_user on z.arena_matches(user_id, game);
