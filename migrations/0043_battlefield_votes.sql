-- ════════════════════════════════════════════════════════════════════════
--  0043_battlefield_votes — the crowd's vote on a duel (the "people's choice",
--  shown separately from the adjudicator's verdict). One row per (session, user);
--  the composite PK enforces one vote per verified spectator, changeable via upsert.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.battlefield_votes (
  session_id uuid not null references z.game_sessions(id) on delete cascade,
  user_id    uuid not null references z.users(id) on delete cascade,
  side       text not null check (side in ('PRO','CON')),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index if not exists bf_votes_session on z.battlefield_votes(session_id);
