-- ════════════════════════════════════════════════════════════════════════
--  0048_reports_blocks — R0: the safety floor for shared spaces.
--  room_reports: any member may report a human or a persona in a room, optionally
--  pinning the offending message. Feeds R1's escalation ledger.
--  user_blocks: a user-level wall — blocks DMs both ways; the client hides the
--  blocked user's lines. (blocker_id, blocked_id) is the whole story.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.room_reports (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  reporter_id uuid not null,
  target_user_id uuid,
  target_persona text,
  message_id uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists room_reports_thread_idx on z.room_reports(thread_id);
create index if not exists room_reports_target_idx on z.room_reports(target_user_id);

create table if not exists z.user_blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index if not exists user_blocks_blocked_idx on z.user_blocks(blocked_id);
