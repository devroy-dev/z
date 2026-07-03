-- 0031: THREAD PREFS — pin / favourite / archive, per user per thread.
-- Lives on z.thread_reads because that table is already the per-(user, thread)
-- home (one row each, works for persona threads AND shared DMs — each member
-- keeps their own flags without affecting the other side). Rows are created
-- lazily by reads or by the first pref set; defaults are all false.

alter table z.thread_reads add column if not exists pinned    boolean not null default false;
alter table z.thread_reads add column if not exists favourite boolean not null default false;
alter table z.thread_reads add column if not exists archived  boolean not null default false;
