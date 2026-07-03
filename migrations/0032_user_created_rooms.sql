-- 0032: USER-CREATED public rooms.
--
-- Individuals can now spin up public rooms (localities, meetups, interests). The
-- CREATOR is the room's moderator during this test phase — they can kick members.
-- The doorman's automated layer stays off (Fable is gathering data to tune it);
-- only the deterministic name/theme gate runs at creation, so the directory itself
-- can't be named abusively.
--
-- created_by: the user who made the room (its moderator). Null for house-seeded
-- rooms (0030). is_house: distinguishes curated house rooms from user-created ones.

alter table z.public_rooms add column if not exists created_by uuid references z.users(id) on delete set null;
alter table z.public_rooms add column if not exists is_house boolean not null default false;

-- mark the existing seeded rooms as house rooms
update z.public_rooms set is_house = true where created_by is null;

-- kicks in user-created rooms reuse z.room_sanctions (kind='kick'); no schema change
-- needed there. The creator-kick path writes a 'kick' sanction with an expiry.
