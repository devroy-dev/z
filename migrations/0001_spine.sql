-- ════════════════════════════════════════════════════════════════════════
--  Z — schema 0001 (the spine)
--  Separate Supabase project. RLS ON from line one, default-deny, user-scoped.
--  This DB holds the most sensitive data the company will ever touch
--  (intimate confession). Every table is locked so a user can reach ONLY
--  their own rows. The engine writes with the service-role key (bypasses RLS,
--  trusted server code) — RLS is the floor that catches us if the engine ever
--  mis-scopes. Defense in depth, not either/or.
-- ════════════════════════════════════════════════════════════════════════

create schema if not exists z;

-- ── extensions ──────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ════════════════════════════════════════════════════════════════════════
--  z.users — one row per person. Identity + their global prefs.
--  auth_user_id ties to Supabase Auth (the owner-binding pattern from dreamai).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique,            -- = auth.uid()
  display_name  text,                            -- what Z calls THEM
  region        text,                            -- for language/slang mirroring (their words, not a label we show)
  locale        text,                            -- e.g. 'en-IN', 'en-PH'
  timezone      text default 'Asia/Kolkata',
  created_at    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  -- soft-delete: the user's right to be forgotten (DPDP). Sweep hard-deletes later.
  deleted_at    timestamptz
);

-- ════════════════════════════════════════════════════════════════════════
--  z.threads — one row per named companion the user created.
--  This is the persona instance: their chosen name + face + which persona/codex.
--  All of a user's threads share ONE memory (z.memory) — facets of one Z.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.threads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references z.users(id) on delete cascade,
  persona_key   text not null,                   -- 'devils_advocate' | 'wingman' | 'flame'
                                                  -- | 'love_sucks' | 'close_cousin' | 'workplace_shit'
                                                  -- | 'detox_doc' | 'mr_anxiety' | 'mr_confident' | 'almost_hot'
  codex_key     text not null,                   -- 'intellect'|'close'|'people'|'shadow'|'inner'|'forward'|'vanity'
  companion_name text not null,                  -- the name THEY gave it (injected as [companion_name])
  companion_gender text,                         -- he | she | neither
  avatar_url    text,                            -- stylized AI image (never photoreal human)
  accent        text,                            -- the blue-temperature for this persona's field
  created_at    timestamptz not null default now(),
  last_active   timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists threads_user on z.threads(user_id) where deleted_at is null;

-- ════════════════════════════════════════════════════════════════════════
--  z.messages — the conversation, per thread. The diary.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.messages (
  id            bigint generated always as identity primary key,
  thread_id     uuid not null references z.threads(id) on delete cascade,
  user_id       uuid not null references z.users(id) on delete cascade,  -- denormalised for RLS + memory reads
  role          text not null check (role in ('user','assistant')),
  content       text not null,
  created_at    timestamptz not null default now()
);
create index if not exists messages_thread on z.messages(thread_id, created_at);

-- ════════════════════════════════════════════════════════════════════════
--  z.memory — the SHARED per-user memory. Every thread reads this; the master
--  knows everything. NOT per-thread — this is the "one self that knows all of me".
--  Stored as discrete, revisable notes (not a blob) so it can be refined over time
--  and surgically deleted. Server-side for now; migrates to on-device-encrypted
--  at the native stage.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.memory (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references z.users(id) on delete cascade,
  kind          text not null default 'note',    -- 'note' | 'person' | 'fact' | 'thread_summary'
  key           text,                             -- optional label e.g. 'sister', 'job', 'the ex'
  value         text not null,                    -- the remembered thing, in plain language
  source_thread uuid references z.threads(id) on delete set null,  -- where it was learned (audit, not gate)
  weight        real not null default 1.0,        -- salience, for future ranking
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists memory_user on z.memory(user_id);

-- ════════════════════════════════════════════════════════════════════════
--  z.access — durable per-user access/usage accounting (forked from
--  consultAccess.ts, but user-keyed, no 3/day gate). Carries NO conversation
--  content — accounting only. Drives subscription/quota later.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.access (
  user_id       uuid primary key references z.users(id) on delete cascade,
  restricted    boolean not null default false,  -- admin kill-switch
  total_turns   bigint not null default 0,
  last_domain   text,
  last_seen     timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
--  RLS — ON for every table, default-deny. A user reaches only their own rows.
--  Policies use auth.uid() resolved through z.users.auth_user_id.
-- ════════════════════════════════════════════════════════════════════════
alter table z.users    enable row level security;
alter table z.threads  enable row level security;
alter table z.messages enable row level security;
alter table z.memory   enable row level security;
alter table z.access   enable row level security;

-- helper: the z.users.id for the current auth user
create or replace function z.current_user_id() returns uuid
  language sql stable security definer set search_path = z as $$
  select id from z.users where auth_user_id = auth.uid() and deleted_at is null
$$;

-- users: you can see/update only your own row
create policy users_self_select on z.users for select using (auth_user_id = auth.uid());
create policy users_self_update on z.users for update using (auth_user_id = auth.uid());

-- threads: only your own
create policy threads_own_select on z.threads for select using (user_id = z.current_user_id());
create policy threads_own_insert on z.threads for insert with check (user_id = z.current_user_id());
create policy threads_own_update on z.threads for update using (user_id = z.current_user_id());
create policy threads_own_delete on z.threads for delete using (user_id = z.current_user_id());

-- messages: only your own
create policy messages_own_select on z.messages for select using (user_id = z.current_user_id());
create policy messages_own_insert on z.messages for insert with check (user_id = z.current_user_id());

-- memory: only your own (the diary nobody else can read)
create policy memory_own_select on z.memory for select using (user_id = z.current_user_id());
create policy memory_own_insert on z.memory for insert with check (user_id = z.current_user_id());
create policy memory_own_update on z.memory for update using (user_id = z.current_user_id());
create policy memory_own_delete on z.memory for delete using (user_id = z.current_user_id());

-- access: read your own only; writes happen server-side via service role
create policy access_own_select on z.access for select using (user_id = z.current_user_id());

-- NOTE: the engine connects with the SERVICE-ROLE key, which bypasses every
-- policy above. That is intentional — the engine is trusted and scopes by
-- user_id in every query. RLS exists so that ANY other path (the anon/public
-- key used by the browser, a future client read, a mistake) is locked to the
-- owner. Never ship the service-role key to the browser.
