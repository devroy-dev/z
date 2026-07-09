-- 0057 — THE NEWSROOM LEARNS YOUR NAME: follows (topics, entities, pinned
-- stories) and the fact-check ledger. The wire personalizes for free; the
-- anchor knocks only when something you care about moves.
-- last_checked/last_seen (beyond the base spec) give §6.2 story-tracking the
-- state it needs to detect development without a second migration.
create table if not exists z.news_follows (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  kind          text not null default 'topic',   -- topic | entity | story
  term          text not null,
  wire_topic    text,
  last_checked  timestamptz,                      -- §6.2 tracking: last development sweep
  last_seen     text,                             -- §6.2 tracking: last known state, to diff against
  created_at    timestamptz not null default now()
);
create index if not exists news_follows_user_idx on z.news_follows (user_id);
create index if not exists news_follows_story_idx on z.news_follows (kind, last_checked) where kind = 'story';
alter table z.news_follows enable row level security;

create table if not exists z.fact_checks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  claim       text not null,
  verdict     text,
  reasoning   text,
  sources     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists fact_checks_user_idx on z.fact_checks (user_id, created_at desc);
alter table z.fact_checks enable row level security;
