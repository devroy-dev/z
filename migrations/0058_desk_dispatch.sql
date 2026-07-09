-- 0058 — THE HOST'S NEW VERBS: task due dates (so the list can knock) and the
-- per-user morning-line opt-in. Verified against live migrations: z.tasks (0013)
-- already has due_at + status + suggested_persona; z.users (0001) is the real table.
-- The due_at add is a harmless no-op kept for fidelity; the index and the two
-- users flags are the real additions.
alter table z.tasks add column if not exists due_at timestamptz;
create index if not exists tasks_due_idx on z.tasks (user_id, due_at) where due_at is not null;

alter table z.users add column if not exists morning_brief boolean not null default false;
alter table z.users add column if not exists morning_brief_hour int not null default 8;
