-- ════════════════════════════════════════════════════════════════════════
--  0056_mm_loop — THE DESK THAT CHECKS: the weekly instruction becomes a
--  tracked task (graded next week), and content ideas file into a pipeline.
--  Work accrues; advice alone never did. The Media Manager stops being a
--  manager who instructs and never inspects — mm_tasks is the loop closing,
--  mm_ideas is his first real deliverable.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.mm_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  instruction  text not null,
  week_of      date not null,
  status       text not null default 'open',   -- open | done | skipped
  created_at   timestamptz not null default now()
);
create index if not exists mm_tasks_user_idx on z.mm_tasks (user_id, week_of desc);
alter table z.mm_tasks enable row level security;

create table if not exists z.mm_ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  title       text not null,
  format      text,
  hook        text,
  status      text not null default 'idea',    -- idea | drafted | posted
  draft       text,
  created_at  timestamptz not null default now()
);
create index if not exists mm_ideas_user_idx on z.mm_ideas (user_id, status, created_at desc);
alter table z.mm_ideas enable row level security;
