-- ════════════════════════════════════════════════════════════════════════
--  Z — schema 0002 (open-mode identity)
--  OPEN_MODE uses anonymous ids like 'open:ab12...' that aren't UUIDs, so the
--  identity column must accept text. Real Supabase UUIDs are still valid text.
--  When auth goes live, new rows carry the real auth.uid() as text; nothing breaks.
-- ════════════════════════════════════════════════════════════════════════

-- drop the policies + helper that depend on the column type, widen it, recreate.
drop policy if exists users_self_select on z.users;
drop policy if exists users_self_update on z.users;
drop function if exists z.current_user_id();

alter table z.users alter column auth_user_id type text using auth_user_id::text;

-- helper: the z.users.id for the current auth user (text compare; auth.uid() cast)
create or replace function z.current_user_id() returns uuid
  language sql stable security definer set search_path = z as $$
  select id from z.users where auth_user_id = auth.uid()::text and deleted_at is null
$$;

create policy users_self_select on z.users for select using (auth_user_id = auth.uid()::text);
create policy users_self_update on z.users for update using (auth_user_id = auth.uid()::text);

-- threads/messages/memory/access policies reference z.current_user_id() which is
-- unchanged in signature, so they keep working as-is.
