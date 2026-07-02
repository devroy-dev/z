-- 0017: learning arcs — days of practice with a persona, a stage final, a grade.
create table if not exists z.arc_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references z.users(id) on delete cascade,
  arc_id text not null,
  day int not null default 1,
  status text not null default 'active',      -- 'active' | 'final_ready' | 'done'
  last_advanced timestamptz,
  final_outcome text,                          -- 'win' | 'loss' | 'draw' when graded
  started_at timestamptz not null default now()
);
create index if not exists arc_progress_user on z.arc_progress (user_id, status);
alter table z.arc_progress enable row level security;
