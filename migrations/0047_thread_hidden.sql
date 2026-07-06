-- ════════════════════════════════════════════════════════════════════════
--  0047_thread_hidden — the DM "delete = hide" flag. Deleting a DM hides it for
--  YOU only (you remain a silent member); an incoming message from the other side
--  clears the flag and the DM reappears. Rides thread_reads (one row per
--  user+thread), same home as pinned/favourite/archived.
-- ════════════════════════════════════════════════════════════════════════
alter table z.thread_reads add column if not exists hidden boolean not null default false;
