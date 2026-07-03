-- 0033: BUILD-A-PERSONA — user-created personas. The soul/codex split makes
-- creation = CODEX GENERATION: the shared Z_SOUL substrate grounds every
-- custom for free; the user authors only the character. The codex text lives
-- here, injected at runtime exactly like a shipped codex — with the HOUSE
-- SEATBELT appended AFTER the creator's text, non-negotiably, so it wins.
--
-- Rollout law (v1): PRIVATE to the creator only. Rooms already filter
-- member_keys through SHAREABLE_PERSONAS, so customs can't enter shared
-- rooms; sharing is v2, public gallery much later.
--
-- status: 'live' | 'blocked' (house kill switch — "retired for house rules")
--         | 'deleted' (owner removed it)

create table if not exists z.custom_personas (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references z.users(id) on delete cascade,
  key            text not null unique,          -- 'custom_<8hex>' — never collides with built-ins
  name           text not null,
  codex          text not null,                 -- the composed house-format codex
  tone           text,                          -- hex accent the owner picked
  face_url       text,                          -- null in v1 (monogram); preset gallery later
  status         text not null default 'live' check (status in ('live','blocked','deleted')),
  created_at     timestamptz not null default now()
);
create index if not exists custom_personas_owner_idx on z.custom_personas (owner_user_id, status);

alter table z.custom_personas enable row level security;
do $$ begin
  create policy custom_personas_owner on z.custom_personas for select
    using (owner_user_id = (select id from z.users where auth_user_id = auth.uid()::text));
exception when duplicate_object then null; end $$;
