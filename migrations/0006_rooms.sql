-- 0006_rooms.sql
-- Shared rooms: real humans join a thread (via invite link) where a Z persona is present.
-- SECURITY: RLS stays ON everywhere. The engine (service-role) is the gate; it checks
-- room_members before every read/write. NO rls-disabled table — ever.

-- many humans per thread (1:1 + persona-group threads simply have one member: the owner)
create table if not exists z.room_members (
  thread_id  uuid not null references z.threads(id) on delete cascade,
  user_id    uuid not null references z.users(id)  on delete cascade,
  role       text not null default 'member',       -- 'owner' | 'member'
  joined_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index if not exists room_members_user on z.room_members(user_id);
alter table z.room_members enable row level security;
-- a user may see their OWN membership rows (which rooms am I in)
drop policy if exists room_members_own on z.room_members;
create policy room_members_own on z.room_members
  for select using (user_id = auth.uid());
-- inserts/updates/deletes happen only via the service-role engine (membership-gated there)

-- invite tokens: one reusable, revocable link per room
create table if not exists z.room_invites (
  token       text primary key,
  thread_id   uuid not null references z.threads(id) on delete cascade,
  created_by  uuid not null references z.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  max_uses    int,
  uses        int not null default 0,
  revoked     boolean not null default false
);
create index if not exists room_invites_thread on z.room_invites(thread_id);
alter table z.room_invites enable row level security;
-- invites are managed only by the engine (service-role); no direct browser access

-- which human sent a message (null for persona messages)
alter table z.messages add column if not exists sender_user_id uuid references z.users(id);

-- mark a thread as a shared (multi-human) room
alter table z.threads add column if not exists is_shared boolean not null default false;

-- defense-in-depth: messages in a shared room are readable only by its members.
-- (the engine already gates via service-role; this is the floor if a direct query slips through.)
drop policy if exists messages_room_members on z.messages;
create policy messages_room_members on z.messages
  for select using (
    user_id = auth.uid()  -- own 1:1 + persona-group messages (existing behaviour)
    or exists (
      select 1 from z.room_members m
      where m.thread_id = z.messages.thread_id and m.user_id = auth.uid()
    )
  );

-- backfill: every existing thread gets its owner as a member, so nothing changes for solo threads
insert into z.room_members (thread_id, user_id, role)
  select id, user_id, 'owner' from z.threads
  on conflict (thread_id, user_id) do nothing;
