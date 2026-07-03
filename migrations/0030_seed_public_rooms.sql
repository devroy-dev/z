-- 0030: seed the first curated public rooms.
--
-- Each room = a house-owned shared thread (is_shared, no user owner in the personal
-- sense — user_id points at a house/system row is not required; we leave user_id to a
-- sentinel and rely on room_members for access). member_keys = resident personas,
-- ALWAYS including the_moderator (the doorman).
--
-- We create the thread and the public_rooms row together in one transaction per room.
-- Idempotent: re-running won't duplicate (guarded by slug uniqueness + not-exists).

do $$
declare
  v_thread uuid;
  v_owner  uuid;
begin
  -- a system owner for house threads: reuse the first existing user as nominal owner
  -- (threads.user_id is NOT NULL). Access is governed by room_members, not this field.
  select id into v_owner from z.users where deleted_at is null order by created_at asc limit 1;
  if v_owner is null then
    raise notice 'no users yet — seed public rooms after at least one account exists';
    return;
  end if;

  -- 1. the football stands
  if not exists (select 1 from z.public_rooms where slug = 'football-stands') then
    insert into z.threads (user_id, is_group, is_shared, member_keys, companion_name)
      values (v_owner, true, true, array['the_media_manager','the_moderator'], 'the football stands')
      returning id into v_thread;
    insert into z.public_rooms (thread_id, slug, name, theme, persona_keys, sort_order)
      values (v_thread, 'football-stands', 'the football stands',
              'match talk, hot takes, and the eternal GOAT debate — kept civil by the doorman',
              array['the_media_manager','the_moderator'], 1);
  end if;

  -- 2. the trading pit
  if not exists (select 1 from z.public_rooms where slug = 'trading-pit') then
    insert into z.threads (user_id, is_group, is_shared, member_keys, companion_name)
      values (v_owner, true, true, array['the_economist','the_moderator'], 'the trading pit')
      returning id into v_thread;
    insert into z.public_rooms (thread_id, slug, name, theme, persona_keys, sort_order)
      values (v_thread, 'trading-pit', 'the trading pit',
              'markets, macro, and money talk — the economist holds court, the doorman holds the line',
              array['the_economist','the_moderator'], 2);
  end if;

  -- 3. late night philosophy
  if not exists (select 1 from z.public_rooms where slug = 'late-night-philosophy') then
    insert into z.threads (user_id, is_group, is_shared, member_keys, companion_name)
      values (v_owner, true, true, array['the_philosopher','the_moderator'], 'late night philosophy')
      returning id into v_thread;
    insert into z.public_rooms (thread_id, slug, name, theme, persona_keys, sort_order)
      values (v_thread, 'late-night-philosophy', 'late night philosophy',
              'the big questions after midnight — meaning, mortality, and why any of it — with the philosopher',
              array['the_philosopher','the_moderator'], 3);
  end if;

  -- 4. the writers' table
  if not exists (select 1 from z.public_rooms where slug = 'writers-table') then
    insert into z.threads (user_id, is_group, is_shared, member_keys, companion_name)
      values (v_owner, true, true, array['the_historian','the_moderator'], 'the writers'' table')
      returning id into v_thread;
    insert into z.public_rooms (thread_id, slug, name, theme, persona_keys, sort_order)
      values (v_thread, 'writers-table', 'the writers'' table',
              'craft, story, and the blank page — swap pages and provocations at the writers'' table',
              array['the_historian','the_moderator'], 4);
  end if;
end $$;
