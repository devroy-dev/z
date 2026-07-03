-- 0022: the anchor's daily bulletins. One national+world edition per day
-- (scope 'in'), plus per-city local editions generated on first request and
-- cached for the day. stories: [{id, kicker, headline, brief}].
create table if not exists z.bulletins (
  id uuid primary key default gen_random_uuid(),
  scope text not null,                 -- 'in' | 'city:<slug>'
  day date not null,
  stories jsonb not null,
  created_at timestamptz not null default now(),
  unique (scope, day)
);
-- the local desk needs to know where you are
alter table z.users add column if not exists city text;
