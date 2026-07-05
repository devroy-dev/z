-- ════════════════════════════════════════════════════════════════════════
--  0042_arena_notes — a free-text notes column on arena_matches so a duel's
--  motion + verdict summary is recorded alongside the result.
--  ALSO repairs the existing debate/trivia ledger writes, which insert `notes`
--  and have been silently failing on this previously-missing column.
-- ════════════════════════════════════════════════════════════════════════
alter table z.arena_matches add column if not exists notes text;
