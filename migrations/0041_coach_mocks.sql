-- ════════════════════════════════════════════════════════════════════════
--  0041_coach_mocks — COACH Layer 4: MOCK TESTS.
--  One row per mock attempt: the full question set (with keys, server-side),
--  a timer, and the graded result with a per-topic breakdown.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.coach_mocks (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references z.coach_courses(id) on delete cascade,
  user_id      uuid not null references z.users(id) on delete cascade,
  questions    jsonb not null default '[]'::jsonb,   -- MCQ[] WITH keys (never sent pre-submit)
  duration_sec int  not null default 1800,
  score        int,
  total        int,
  breakdown    jsonb,                                -- { tag: { right, total } }
  status       text not null default 'active',       -- active | done
  started_at   timestamptz not null default now(),
  submitted_at timestamptz
);
create index if not exists coach_mocks_course_idx on z.coach_mocks(course_id);
create index if not exists coach_mocks_user_idx   on z.coach_mocks(user_id);
