-- ════════════════════════════════════════════════════════════════════════
--  Z — schema 0002 (open-mode identity)  [corrected for policy dependencies]
--  OPEN_MODE uses anonymous ids like 'open:ab12...' that aren't UUIDs, so the
--  identity column must accept text. Real Supabase UUIDs are still valid text.
--  Many policies depend on z.current_user_id(), so we drop them all, swap the
--  function + column, then recreate every policy. Safe to run once.
-- ════════════════════════════════════════════════════════════════════════

-- 1) drop every policy that depends on the helper or the column
drop policy if exists users_self_select    on z.users;
drop policy if exists users_self_update    on z.users;
drop policy if exists threads_own_select   on z.threads;
drop policy if exists threads_own_insert   on z.threads;
drop policy if exists threads_own_update   on z.threads;
drop policy if exists threads_own_delete   on z.threads;
drop policy if exists messages_own_select  on z.messages;
drop policy if exists messages_own_insert  on z.messages;
drop policy if exists memory_own_select    on z.memory;
drop policy if exists memory_own_insert    on z.memory;
drop policy if exists memory_own_update    on z.memory;
drop policy if exists memory_own_delete    on z.memory;
drop policy if exists access_own_select    on z.access;

-- 2) now the helper has no dependents — drop + widen the column
drop function if exists z.current_user_id();
alter table z.users alter column auth_user_id type text using auth_user_id::text;

-- 3) recreate the helper (text compare; auth.uid() cast to text)
create or replace function z.current_user_id() returns uuid
  language sql stable security definer set search_path = z as $$
  select id from z.users where auth_user_id = auth.uid()::text and deleted_at is null
$$;

-- 4) recreate every policy exactly as before
create policy users_self_select on z.users for select using (auth_user_id = auth.uid()::text);
create policy users_self_update on z.users for update using (auth_user_id = auth.uid()::text);

create policy threads_own_select on z.threads for select using (user_id = z.current_user_id());
create policy threads_own_insert on z.threads for insert with check (user_id = z.current_user_id());
create policy threads_own_update on z.threads for update using (user_id = z.current_user_id());
create policy threads_own_delete on z.threads for delete using (user_id = z.current_user_id());

create policy messages_own_select on z.messages for select using (user_id = z.current_user_id());
create policy messages_own_insert on z.messages for insert with check (user_id = z.current_user_id());

create policy memory_own_select on z.memory for select using (user_id = z.current_user_id());
create policy memory_own_insert on z.memory for insert with check (user_id = z.current_user_id());
create policy memory_own_update on z.memory for update using (user_id = z.current_user_id());
create policy memory_own_delete on z.memory for delete using (user_id = z.current_user_id());

create policy access_own_select on z.access for select using (user_id = z.current_user_id());
