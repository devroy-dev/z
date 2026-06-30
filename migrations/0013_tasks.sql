-- 0013_tasks.sql — The Front Desk: structured tasks the concierge holds for the user.
-- The Front Desk persona can add / list / complete these, and (when native ships) remind on them.
-- suggested_persona = which room of callmeZ can help with this (the routing magic). Nullable.

create table if not exists z.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references z.users(id) on delete cascade,
  title             text not null,
  notes             text,                       -- optional detail
  due_at            timestamptz,                -- optional deadline / reminder time
  status            text not null default 'open',   -- 'open' | 'done'
  suggested_persona text,                        -- persona key the Front Desk routed to (e.g. 'the_orator')
  created_at        timestamptz not null default now(),
  done_at           timestamptz
);

create index if not exists tasks_user_open_idx on z.tasks (user_id, status, due_at);

-- RLS: a user sees only their own tasks.
alter table z.tasks enable row level security;

do $$ begin
  create policy tasks_owner on z.tasks
    for all using (user_id = (select id from z.users where auth_user_id = auth.uid()))
    with check (user_id = (select id from z.users where auth_user_id = auth.uid()));
exception when duplicate_object then null; end $$;
