-- 0012_roleplay.sql — mission-roleplay (the Freedom Space).
-- A roleplay is a GROUP thread with an active scenario. scenario_key names which
-- scenario from ROLEPLAY.md is running (or 'custom' for a user-typed one); the custom
-- premise (if any) lives in scenario_brief. The moderator directs + judges; resolution
-- emits a [[VERDICT outcome=...]] tag, persisted to roleplay_runs.

alter table z.threads add column if not exists scenario_key text;     -- 'hearing' | 'throne' | 'ledge' | 'custom' | null
alter table z.threads add column if not exists scenario_brief text;   -- the player's role + custom premise, fed to the director

create table if not exists z.roleplay_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references z.users(id),
  scenario    text,
  player_role text,
  outcome     text,            -- 'win' | 'loss' | 'draw'
  created_at  timestamptz not null default now()
);

alter table z.roleplay_runs enable row level security;
create policy roleplay_runs_self on z.roleplay_runs
  for all using (user_id in (select id from z.users where auth_user_id = auth.uid()::text));
