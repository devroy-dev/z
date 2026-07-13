-- 0064 — SETTLE IT: the WhatsApp argument that ends in an adjudicated ruling.
-- A challenge carries the vetted motion + the challenger's stance; the link rides
-- the claim pattern (accept = both seats filled, a normal duel — no parallel
-- machinery). Expiry is LAZY (7 days from created_at, marked at read/claim time).
-- Reserved-block law: 0064 challenges · 0065 HOLE (votes = 0043, pre-reservation)
-- · 0066 record · 0067 ratings.
create table if not exists z.battlefield_challenges (
  id           uuid primary key default gen_random_uuid(),
  challenger   uuid not null,
  motion       text not null,
  domain       text,
  format_key   text not null default 'duel',
  challenger_side text not null default 'pro',
  timed        boolean not null default false,
  status       text not null default 'open',   -- open | accepted | expired | done
  session_id   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists bf_challenges_user_idx on z.battlefield_challenges (challenger, created_at desc);
alter table z.battlefield_challenges enable row level security;
