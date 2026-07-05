-- ════════════════════════════════════════════════════════════════════════
--  0044_coach_library — THE HOUSE SUBJECT LIBRARY (shared corpus).
--  (Renumbered from 0043 to avoid collision with 0043_battlefield_votes.)
--  Hand-authored SKILL + SUBJECT-KNOWLEDGE codices live on one librarian-owned
--  shelf, tagged by subject, with NO course_id — shared by every learner in
--  "house" mode. Distinct from a user's private uploaded material (course-scoped).
--  Ingest is brief-direct (parse §s → embed → insert; the 0040 sync trigger builds
--  FTS + HNSW). The Sonnet clerk is NOT used for hand-authored house material.
-- ════════════════════════════════════════════════════════════════════════

alter table z.coach_briefs add column if not exists subject_key text;
create index if not exists coach_briefs_library_idx
  on z.coach_briefs (user_id, subject_key) where superseded_by is null;

-- the librarian: one synthetic user that owns every house codex brief (FK owner only).
insert into z.users (id, auth_user_id, display_name, region)
values ('00000000-0000-4000-8000-00000000010c',
        '00000000-0000-4000-8000-0000000001cc',
        'The Library', 'IN')
on conflict (id) do nothing;
