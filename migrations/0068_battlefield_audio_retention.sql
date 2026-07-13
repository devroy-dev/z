-- 0068 — §7 VOICE AUDIT: the duel's spoken word goes PRIVATE.
-- The old path stored PERMANENT PUBLIC URLs from a public 'duel-audio' bucket —
-- anyone with a URL could replay a debater's voice forever. The spec's law:
-- private bucket ('battlefield-audio') + SIGNED URLs minted at read time +
-- 30-day audio retention (the transcript is forever; the voice is not).
-- Reserved-block law held: 0067 stays reserved for ratings; retention takes 0068.

-- the private bucket (idempotent; service-role signs, no public policy exists)
insert into storage.buckets (id, name, public)
values ('battlefield-audio', 'battlefield-audio', false)
on conflict (id) do nothing;

-- the retention stamp: the sweeper marks a record when its audio is purged,
-- so a session is swept exactly once.
alter table z.battlefield_record add column if not exists audio_purged_at timestamptz;
