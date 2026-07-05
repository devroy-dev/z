-- ════════════════════════════════════════════════════════════════════════
--  0045_coach_modes — house vs custom on a course.
--  mode='house'  → the course reads the shared LIBRARY for subject_key (codex plan).
--  mode='custom' → the course reads the user's OWN uploaded material (course-scoped).
--  Existing courses default to 'custom' (behaviour-preserving: their own briefs / web).
-- ════════════════════════════════════════════════════════════════════════
alter table z.coach_courses add column if not exists mode text not null default 'custom';
alter table z.coach_courses add column if not exists subject_key text;
