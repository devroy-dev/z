-- 0080 — THE SESSION: two humans, a moderator, a structured sitting.
-- The room is the mediator; the wall is absolute. (ROOMS_SPEC_V2 §4.3, as
-- written; 0081 stays RESERVED for session follow-ons — never fill early.
-- 0064–0079 remain other specs' reservations/holes — never renumber.)
create table if not exists z.sessions (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null,               -- the room (is_shared, is_session flag on threads)
  format        text not null,               -- clear_the_air | check_in | cofounder | bridge
  moderator_key text not null default 'the_healer',
  initiator     uuid not null,
  invitee       uuid,                        -- filled on accept
  status        text not null default 'invited',  -- invited | live | closed | ended
  phase         int not null default 0,
  floor_holder  uuid,                        -- whose turn the room is holding
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);
alter table z.sessions enable row level security;
alter table z.threads add column if not exists is_session boolean not null default false;

-- [addition, declared] the hot lookups: /chat checks thread→session every
-- session turn; the SESSIONS pane lists by either party.
create index if not exists sessions_thread on z.sessions (thread_id);
create index if not exists sessions_initiator on z.sessions (initiator, created_at desc);
create index if not exists sessions_invitee on z.sessions (invitee, created_at desc);
