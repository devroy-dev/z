-- 0062 — THE SAFETY SET, reduced per the ROOMS_STATUS audit: 0048 already
-- shipped room_reports + user_blocks (blocker_id schema — the v1 SQL for
-- user_blocks is DEAD, never apply it). What remains: report triage state,
-- the room-mute thread pref, and the owner's review view.
alter table z.room_reports add column if not exists status text not null default 'open';   -- open | reviewed | actioned

-- mute room = a thread pref: kills its notifications only (v1 §6.2). Data +
-- affordance land here; the enforcement point arrives with room notifications
-- (v1 §10 — @handle mentions / tonight-at-the-house), which do not exist yet.
alter table z.thread_reads add column if not exists muted boolean not null default false;

-- the owner's review surface: a bare SQL view is the admin tooling at this
-- scale (v1 §6.2). Read from the Supabase dashboard with the service role;
-- reports against the room itself carry both targets null.
create or replace view z.open_room_reports as
select r.id, r.created_at, r.status, r.reason,
       r.thread_id, t.companion_name as room_name,
       r.reporter_id, r.target_user_id, r.target_persona, r.message_id,
       (r.target_user_id is null and r.target_persona is null) as reports_the_room
from z.room_reports r
left join z.threads t on t.id = r.thread_id
where r.status = 'open'
order by r.created_at desc;
