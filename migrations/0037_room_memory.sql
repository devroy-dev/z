-- ════════════════════════════════════════════════════════════════════════
--  0037_room_memory — GROUP MEMORY (the moat).
--  z.room_memory is a shared room's COLLECTIVE memory: what the personas
--  remember about THIS room and its people, built ONLY from what was said in
--  the room (visible to every member) and injected back ONLY into that room.
--  Distinct from z.memory (per-user PRIVATE memory), which stays suppressed in
--  shared rooms. Nothing here crosses the room boundary.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.room_memory (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references z.threads(id) on delete cascade,
  kind          text not null default 'note',   -- 'note' | 'bit'
  key           text,                            -- short label (the upsert handle)
  value         text not null,                   -- the fact / bit, in plain language
  subject_name  text,                            -- the member this is about (nullable)
  weight        int  not null default 0,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists room_memory_thread_idx on z.room_memory(thread_id);
