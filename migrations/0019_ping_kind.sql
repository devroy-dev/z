-- 0019: pings grow a kind — 'followup' (the evening chase) vs 'brief' (the
-- morning note). The one-per-day law counts followups only; the brief is
-- its own daily rhythm.
alter table z.ping_log add column if not exists kind text not null default 'followup';
