-- 0023: the desk campaign. One migration for sittings 2b zips 2–4:
--   • users.onboarding_stage — the interview overlay's progress (0 = not started,
--     1..N = mid-interview, -1 = done/retired)
--   • z.scheduled_pings — the concierge's clock: bookings ("poker at 9") and
--     timed reminders; a scheduler delivers each as a real message in-thread
--     when due (push later, when FCM lands — same rows, new delivery layer)
--   • z.feedback — the complaints window; the desk writes, Dev reads

alter table z.users add column if not exists onboarding_stage int not null default 0;

create table if not exists z.scheduled_pings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  persona_key text not null,                -- who the message comes FROM
  thread_id uuid,                           -- where it lands (null = resolve/create at fire time)
  kind text not null,                       -- 'booking' | 'reminder'
  body text not null,                       -- what the persona says when it fires
  payload jsonb,                            -- booking details: { game, room_id, session_id } etc.
  due_at timestamptz not null,
  fired_at timestamptz,                     -- null = pending
  created_at timestamptz not null default now()
);
create index if not exists scheduled_pings_due on z.scheduled_pings (due_at) where fired_at is null;

create table if not exists z.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  body text not null,
  context text,                             -- what they were doing / which room
  created_at timestamptz not null default now()
);

alter table z.scheduled_pings enable row level security;
alter table z.feedback enable row level security;
-- service-role writes/reads only (the engine); no public policies.
