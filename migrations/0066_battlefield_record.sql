-- 0066 — THE RECORD: every duel gets a row the directory, ladder, and cards
-- read — sessions stay the source of truth for state; this is the index.
-- Lifecycle: inserted at duel creation (status live — the directory's LIVE NOW
-- reads live rows), verdict lands on completion (done), the sweeper marks rows
-- abandoned when their session goes dead unfinished (>48h inactive). A duel
-- that somehow completes after abandonment is finalized done — the record
-- never blocks a real verdict. Visibility: public (duel/start) | link
-- (challenges — a settled argument is the two parties' to share) | private
-- (practice — feeds the GM's record line, never the directory).
create table if not exists z.battlefield_record (
  session_id  uuid primary key,
  format_key  text not null,
  motion      text not null,
  domain      text,
  sides       jsonb,              -- [{side, seats:[{user_id|persona}]}]
  status      text not null default 'live',   -- live | done | abandoned
  verdict     jsonb,              -- winner, verdict_line, summary, matter, manner, closing | {failed}
  crowd       jsonb,              -- {pro, con, total} final tally
  visibility  text not null default 'public', -- public | link | private
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index if not exists bf_record_live_idx on z.battlefield_record (status, started_at desc);
alter table z.battlefield_record enable row level security;
