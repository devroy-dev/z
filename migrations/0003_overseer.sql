-- 0003_overseer.sql
-- The OVERSEER's memory: what Z (the observer, not the chat personas) understands
-- about a person, and the letters it writes back to them.
--
-- Design principles (locked with Dev):
--   * STATE OF FEELING, not state of mind. Not medical. No diagnosis, no labels.
--     Z is a support system — moral, emotional, compassionate. Dilwale.
--   * Notes = Z's running private observations (terse, for Z's own continuity).
--   * Summaries = the LETTER: first-person, addressed to the user, warm, theirs to read.
--   * Highest-trust data in the app. RLS on from line one. The user can see & delete
--     their own letters and notes — it's their file, never a secret dossier.

-- ── user_notes : Z's running observations about the person ───────────────────
create table if not exists z.user_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references z.users(id) on delete cascade,
  note        text not null,                 -- a single observation, in Z's words (terse)
  source      text,                          -- optional: which thread/period prompted it
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists user_notes_user_idx on z.user_notes(user_id, created_at desc);

-- ── user_summaries : the LETTERS Z writes to the person ──────────────────────
create table if not exists z.user_summaries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references z.users(id) on delete cascade,
  kind          text not null check (kind in ('daily','weekly')),
  -- daily kind = a short ANECDOTE (a small human moment Z noticed that day).
  -- weekly kind = the LETTER (first-person, addressed to the user, ties the week together).
  body          text not null,               -- the anecdote (daily) or the letter (weekly)
  period_start  date not null,
  period_end    date not null,
  created_at    timestamptz not null default now(),
  read_at       timestamptz                  -- when the user opened it (for the unread dot)
);
create index if not exists user_summaries_user_idx on z.user_summaries(user_id, period_end desc);

-- ── RLS : own-row only, exactly like the rest of the spine ───────────────────
alter table z.user_notes     enable row level security;
alter table z.user_summaries enable row level security;

-- notes: the user can read & delete their own; writes come from the service role (cron)
create policy notes_own_select on z.user_notes for select using (user_id = z.current_user_id());
create policy notes_own_delete on z.user_notes for delete using (user_id = z.current_user_id());

-- summaries (letters): the user can read, update (mark read), and delete their own
create policy summaries_own_select on z.user_summaries for select using (user_id = z.current_user_id());
create policy summaries_own_update on z.user_summaries for update using (user_id = z.current_user_id());
create policy summaries_own_delete on z.user_summaries for delete using (user_id = z.current_user_id());

-- NOTE: inserts are performed by the nightly overseer using the service-role key,
-- which bypasses RLS. No insert policy is granted to end users by design — a person
-- cannot fabricate notes or letters about themselves; only the overseer writes them.
