-- 0004_journal.sql
-- The audio journal: "just record." User speaks, Sarvam transcribes (codemix, Indian
-- languages), Z holds the TEXT (audio discarded). Silent by default — Z keeps it and
-- reflects it in the letters, rather than replying in the moment.
--
-- The transcript is overseer material: it flows through the SAME overseer codex (§4 body/
-- food, §5 danger) as chat does. No separate unguarded path. Voice is rawer than typed
-- text, so the same care rules must cover it.

create table if not exists z.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references z.users(id) on delete cascade,
  transcript  text not null,                 -- the words; audio itself is never stored
  lang        text,                          -- detected language code, if returned
  created_at  timestamptz not null default now()
);
create index if not exists journal_user_idx on z.journal_entries(user_id, created_at desc);

alter table z.journal_entries enable row level security;

-- the user's own file: read & delete their own. writes come from the engine (service role)
-- after transcription, same as the rest.
create policy journal_own_select on z.journal_entries for select using (user_id = z.current_user_id());
create policy journal_own_delete on z.journal_entries for delete using (user_id = z.current_user_id());
