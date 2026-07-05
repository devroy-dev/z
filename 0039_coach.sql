-- ════════════════════════════════════════════════════════════════════════
--  0039_coach — THE COACH (tutoring engine v1).
--  One row per course a student is running: the plan, per-day progress
--  (lesson + quiz-with-key + grade), and accumulated weak spots for adaptation.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.coach_courses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references z.users(id) on delete cascade,
  topic         text not null,
  total_days    int  not null default 7,
  current_day   int  not null default 1,
  plan          jsonb not null default '[]'::jsonb,   -- DayFocus[]
  progress      jsonb not null default '{}'::jsonb,   -- { "1": { lesson, quiz(MCQ[] w/ key), graded } }
  weak_tags     jsonb not null default '[]'::jsonb,   -- accumulated weak spots
  status        text  not null default 'active',      -- active | done
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists coach_courses_user_idx on z.coach_courses(user_id);
