-- 0021: multiplayer game sessions. Server-authoritative state bound to a
-- room (thread). seats: array of {kind:'user'|'persona', id}. version
-- increments on every applied move; clients send their version and get a
-- 409 if stale. Hidden info (cups, hole cards) is filtered per viewer at
-- the API layer — raw state never leaves the server.
create table if not exists z.game_sessions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  game text not null,
  state jsonb not null,
  seats jsonb not null,
  version int not null default 1,
  status text not null default 'live',      -- live | over
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists game_sessions_thread on z.game_sessions(thread_id);
